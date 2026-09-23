#!/usr/bin/env python3
"""
Sitemap URL Extractor
Accepts a bare site name or URL, finds its robots.txt, walks every nested
sitemap index (multiprocessing, shared work queue), and streams every page
URL found into a CSV.
"""
import argparse
import csv
import gzip
import multiprocessing
import re
import sys
import time
import xml.etree.ElementTree as ET

SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
MAX_DEPTH = 6
FETCH_TIMEOUT = 20
FETCH_RETRIES = 2
RETRY_BACKOFF = 0.75
PROGRESS_INTERVAL = 2.0

COMMON_SITEMAP_PATHS = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap/sitemap.xml",
    "/sitemaps/sitemap.xml",
    "/sitemap/index.xml",
    "/wp-sitemap.xml",
    "/news-sitemap.xml",
    "/product-sitemap.xml",
    "/page-sitemap.xml",
]

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}


def make_session():
    try:
        import cloudscraper
        return cloudscraper.create_scraper()
    except ImportError:
        import requests
        session = requests.Session()
        session.headers.update(DEFAULT_HEADERS)
        return session


def extract_host(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", "", raw)
    return re.split(r"[/?#]", raw, maxsplit=1)[0].strip().rstrip(".")


# Order to try schemes in when the caller hasn't pinned one down yet. Some sites
# only listen on plain HTTP (no TLS on 443 at all), which surfaces as a
# connection-level failure ("Connection refused") rather than an HTTP error —
# that's the failure mode this fallback exists for.
SCHEME_ORDER = ("http", "https")


def _is_clean_http_failure(err: str) -> bool:
    """True when `err` came from a real HTTP response (status code or a
    bot-protection page), meaning switching scheme won't change the outcome."""
    return err.startswith("HTTP ") or err == "HTML/bot-protection page returned instead of XML"


def fetch_with_scheme_fallback(session, host: str, path: str, log):
    """Tries each scheme in SCHEME_ORDER against host+path, only moving on to
    the next scheme when the previous one failed at the connection level
    (refused/timeout/SSL/etc) rather than with a normal HTTP response.
    Returns (content, base_url, error_message_or_None)."""
    last_err = None
    for i, scheme in enumerate(SCHEME_ORDER):
        url = f"{scheme}://{host}{path}"
        log(f"[INFO] Trying {url}")
        content, err = fetch(session, url)
        if content is not None:
            return content, f"{scheme}://{host}", None

        last_err = err
        if _is_clean_http_failure(err):
            return None, f"{scheme}://{host}", err
        if i < len(SCHEME_ORDER) - 1:
            log(f"[WARN] {scheme}:// failed ({err}), retrying over {SCHEME_ORDER[i + 1]}://")

    return None, f"{SCHEME_ORDER[0]}://{host}", last_err


def _swap_scheme(url: str):
    if url.startswith("https://"):
        return "http://" + url[len("https://"):]
    if url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return None


def fetch_resilient(session, url: str, log):
    """Fetches an already-absolute URL (e.g. from a robots.txt `Sitemap:`
    directive or a <loc> entry). Sites sometimes advertise the wrong scheme
    for themselves (e.g. an https:// sitemap URL on a host that only answers
    on port 80) — on a connection-level failure, retry once with the scheme
    swapped. Returns (content, resolved_url, error_message_or_None)."""
    content, err = fetch(session, url)
    if content is not None:
        return content, url, None
    if _is_clean_http_failure(err):
        return None, url, err

    alt_url = _swap_scheme(url)
    if not alt_url:
        return None, url, err

    log(f"[WARN] {url} failed ({err}), retrying over {alt_url.split('://', 1)[0]}://")
    content, err2 = fetch(session, alt_url)
    if content is not None:
        return content, alt_url, None
    return None, alt_url, err2


def is_html_challenge(content: bytes) -> bool:
    stripped = content.strip()
    return stripped.startswith(b"<!DOCTYPE") or stripped.startswith(b"<html")


def maybe_decompress(url: str, content: bytes) -> bytes:
    if content[:2] == b"\x1f\x8b" or url.lower().endswith(".gz"):
        try:
            return gzip.decompress(content)
        except Exception:
            return content
    return content


def fetch(session, url: str):
    """Returns (content_bytes, error_message_or_None)."""
    last_err = None
    for attempt in range(FETCH_RETRIES + 1):
        try:
            resp = session.get(url, timeout=FETCH_TIMEOUT)
            if resp.status_code >= 500 and attempt < FETCH_RETRIES:
                last_err = f"HTTP {resp.status_code}"
                time.sleep(RETRY_BACKOFF * (attempt + 1))
                continue
            if resp.status_code != 200:
                return None, f"HTTP {resp.status_code}"
            content = maybe_decompress(url, resp.content)
            if is_html_challenge(content):
                return None, "HTML/bot-protection page returned instead of XML"
            return content, None
        except Exception as e:
            last_err = str(e)
            if attempt < FETCH_RETRIES:
                time.sleep(RETRY_BACKOFF * (attempt + 1))
                continue
    return None, last_err or "unknown error"


LOC_RE = re.compile(rb"<loc>\s*([^<]+?)\s*</loc>")


def parse_sitemap(content: bytes):
    """Returns ('index', [urls]) or ('urlset', [urls]) or ('unknown', [])."""
    try:
        root = ET.fromstring(content)
        tag = root.tag.rsplit("}", 1)[-1]
        ns = {"ns": SITEMAP_NS}
        if tag == "sitemapindex":
            children = []
            for sm in root.findall("ns:sitemap", ns) or root.findall("sitemap"):
                loc = sm.find("ns:loc", ns) if sm.find("ns:loc", ns) is not None else sm.find("loc")
                if loc is not None and loc.text:
                    children.append(loc.text.strip())
            return "index", children
        elif tag == "urlset":
            pages = []
            for u in root.findall("ns:url", ns) or root.findall("url"):
                loc = u.find("ns:loc", ns) if u.find("ns:loc", ns) is not None else u.find("loc")
                if loc is not None and loc.text:
                    pages.append(loc.text.strip())
            return "urlset", pages
    except ET.ParseError:
        pass

    # Lenient fallback for slightly malformed XML
    locs = [m.decode("utf-8", "ignore") for m in LOC_RE.findall(content)]
    if not locs:
        return "unknown", []
    if b"<sitemapindex" in content:
        return "index", locs
    return "urlset", locs


def parse_txt_index(content: bytes):
    text = content.decode("utf-8", "ignore")
    return [line.strip() for line in text.splitlines() if line.strip()]


def get_sitemaps_from_robots(session, host: str, log):
    log(f"[INFO] Fetching robots.txt for {host}")
    content, base_url, err = fetch_with_scheme_fallback(session, host, "/robots.txt", log)
    if content is None:
        log(f"[ERROR] Failed to fetch robots.txt: {err}")
        return []

    sitemap_urls = []
    for line in content.decode("utf-8", "ignore").splitlines():
        line = line.strip()
        if line.lower().startswith("sitemap:"):
            sitemap_urls.append(line.split(":", 1)[1].strip())

    if sitemap_urls:
        log(f"[INFO] Found {len(sitemap_urls)} parent sitemap(s) in robots.txt")
        return sitemap_urls

    log("[WARN] No Sitemap: directive found in robots.txt. Trying common paths...")
    for path in COMMON_SITEMAP_PATHS:
        candidate = base_url + path
        c, resolved, e = fetch_resilient(session, candidate, log)
        if c is not None:
            log(f"[INFO] Found sitemap at: {resolved}")
            sitemap_urls.append(resolved)
            break
        log(f"[INFO] {candidate} -> {e}")

    if not sitemap_urls:
        log(f"[WARN] No sitemaps found via robots.txt or common paths for {base_url}")

    return sitemap_urls


# ─── Worker process ──────────────────────────────────────────────────────────

def worker_loop(work_q, results_q, visited, done_counter, counter_lock, stop_event):
    session = make_session()

    def log(msg):
        # fetch_resilient's messages already carry a "[LEVEL] " prefix; route
        # them to the matching queue kind so drain() doesn't double-tag them.
        if msg.startswith("[WARN] "):
            results_q.put(("warn", msg[len("[WARN] "):]))
        elif msg.startswith("[INFO] "):
            results_q.put(("info", msg[len("[INFO] "):]))
        else:
            results_q.put(("info", msg))

    while not stop_event.is_set():
        try:
            url, depth = work_q.get(timeout=0.5)
        except Exception:
            continue

        try:
            with counter_lock:
                if url in visited:
                    continue
                visited[url] = True

            if depth > MAX_DEPTH:
                results_q.put(("warn", f"Max depth exceeded, skipping: {url}"))
                continue

            content, resolved_url, err = fetch_resilient(session, url, log)
            if content is None:
                results_q.put(("warn", f"Failed to fetch {url}: {err}"))
                continue

            if resolved_url.lower().endswith(".txt"):
                children = parse_txt_index(content)
                kind = "index"
            else:
                kind, children = parse_sitemap(content)

            if kind == "index":
                for child in children:
                    work_q.put((child, depth + 1))
                results_q.put(("info", f"[index] {resolved_url} -> {len(children)} child sitemap(s)"))
            elif kind == "urlset":
                if children:
                    results_q.put(("urls", children))
                results_q.put(("info", f"[sitemap] {resolved_url} -> {len(children)} URL(s)"))
            else:
                results_q.put(("warn", f"Could not classify sitemap content: {resolved_url}"))
        finally:
            with counter_lock:
                done_counter.value += 1
            work_q.task_done()


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="Sitemap URL Extractor")
    parser.add_argument("--site_url", required=True, help="Site name or URL, e.g. https://example.com")
    parser.add_argument("--output_file", default="", help="Path to save the output CSV file")
    parser.add_argument("--max_workers", type=int, default=10, help="Number of worker processes")
    args = parser.parse_args()

    def log(line):
        print(line, flush=True)

    host = extract_host(args.site_url)
    session = make_session()
    parents = get_sitemaps_from_robots(session, host, log)

    if not parents:
        log("[ERROR] No sitemaps found. Nothing to extract.")
        sys.exit(1)

    output_file = args.output_file or "extracted_urls.csv"
    csv_file = open(output_file, "w", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)
    writer.writerow(["URL"])

    manager = multiprocessing.Manager()
    work_q = manager.JoinableQueue()
    results_q = manager.Queue()
    visited = manager.dict()
    done_counter = manager.Value("i", 0)
    urls_counter = manager.Value("i", 0)
    counter_lock = manager.Lock()
    stop_event = manager.Event()

    for p in parents:
        work_q.put((p, 0))

    workers = [
        multiprocessing.Process(
            target=worker_loop,
            args=(work_q, results_q, visited, done_counter, counter_lock, stop_event),
            daemon=True,
        )
        for _ in range(max(1, args.max_workers))
    ]
    for w in workers:
        w.start()

    log(f"[INFO] Starting crawl with {len(workers)} worker process(es)...")

    stop_draining = False

    def drain():
        nonlocal stop_draining
        last_report = 0.0
        while not stop_draining:
            drained_any = False
            while True:
                try:
                    kind, payload = results_q.get_nowait()
                except Exception:
                    break
                drained_any = True
                try:
                    if kind == "urls":
                        writer.writerows([[u] for u in payload])
                        with counter_lock:
                            urls_counter.value += len(payload)
                    elif kind == "warn":
                        log(f"[WARN] {payload}")
                    elif kind == "info":
                        log(f"[INFO] {payload}")
                except Exception as e:
                    # Never let a single bad payload (e.g. an unencodable
                    # character) kill the only thread draining results.
                    sys.stderr.write(f"[WARN] Failed to process a result: {e}\n")

            now = time.time()
            if now - last_report >= PROGRESS_INTERVAL:
                queued = work_q.qsize() if hasattr(work_q, "qsize") else 0
                log(f"[PROGRESS] done={done_counter.value} queued={queued} urls={urls_counter.value}")
                last_report = now
                csv_file.flush()

            if not drained_any:
                time.sleep(0.2)

    import threading
    drain_thread = threading.Thread(target=drain, daemon=True)
    drain_thread.start()

    work_q.join()
    stop_event.set()

    # Final drain to catch anything queued right before completion
    time.sleep(0.5)
    stop_draining = True
    drain_thread.join(timeout=5)

    for w in workers:
        w.join(timeout=2)
        if w.is_alive():
            w.terminate()

    csv_file.flush()
    csv_file.close()

    log(f"[PROGRESS] done={done_counter.value} queued=0 urls={urls_counter.value}")
    log(f"[DONE] Completed — {done_counter.value} sitemap file(s) processed, {urls_counter.value} page URL(s) extracted.")


if __name__ == "__main__":
    main()
