#!/usr/bin/env python3
"""
Indexing Checker
Checks Google Search Console URL Inspection API for each URL, concurrently.
Saves a full CSV report to --output_file.
"""
import argparse
import threading
import time
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2 import service_account
import pandas as pd

MAX_WORKERS = 8
MAX_RETRIES = 3
RETRY_STATUS_CODES = {429, 403, 500, 503}
RETRY_REASONS = {"quotaExceeded", "rateLimitExceeded", "userRateLimitExceeded"}


def is_indexed(coverage_state: str) -> str:
    state = (coverage_state or "").lower()
    if "indexed" in state and "not indexed" not in state:
        return "Yes"
    return "No"


def is_retryable(error: HttpError) -> bool:
    status = error.resp.status if error.resp else None
    if status not in RETRY_STATUS_CODES:
        return False
    try:
        reasons = {e.get("reason") for e in error.error_details} if hasattr(error, "error_details") else set()
    except Exception:
        reasons = set()
    if status == 429:
        return True
    return bool(reasons & RETRY_REASONS) or status in (500, 503)


def inspect_url(thread_local, credentials, gsc_property, url):
    if not hasattr(thread_local, "service"):
        thread_local.service = build("searchconsole", "v1", credentials=credentials)
    service = thread_local.service

    delay = 1
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = service.urlInspection().index().inspect(body={
                "inspectionUrl": url,
                "siteUrl": gsc_property,
            }).execute()
            index_result = response["inspectionResult"]["indexStatusResult"]
            coverage_state = index_result.get("coverageState")
            return {
                "URL": url,
                "Coverage State": coverage_state,
                "Indexing State": index_result.get("indexingState"),
                "Last Crawl Time": index_result.get("lastCrawlTime"),
                "Verdict": index_result.get("verdict", "UNKNOWN"),
                "Indexed": is_indexed(coverage_state),
            }
        except HttpError as e:
            last_error = e
            if attempt < MAX_RETRIES and is_retryable(e):
                time.sleep(delay)
                delay *= 2
                continue
            break
        except Exception as e:
            last_error = e
            break

    message = str(last_error)[:100] if last_error else "Unknown error"
    return {
        "URL": url,
        "Coverage State": "ERROR",
        "Indexing State": "ERROR",
        "Last Crawl Time": "",
        "Verdict": message,
        "Indexed": "No",
    }


def main():
    parser = argparse.ArgumentParser(description="Indexing Checker")
    parser.add_argument("--service_account_file", required=True)
    parser.add_argument("--gsc_property", required=True, help="Exact GSC property URL")
    parser.add_argument("--urls", default="", help="Newline-separated URLs to check")
    parser.add_argument("--csv_file", default="", help="CSV file with a 'url' column")
    parser.add_argument("--output_file", default="index_status_report.csv")
    args = parser.parse_args()

    # Load URLs
    if args.csv_file:
        df = pd.read_csv(args.csv_file)
        df.columns = df.columns.str.strip().str.lower()
        urls = df["url"].dropna().tolist()
        print(f"[INFO] Loaded {len(urls)} URLs from CSV")
    elif args.urls:
        urls = [u.strip() for u in args.urls.splitlines() if u.strip()]
        print(f"[INFO] Loaded {len(urls)} URLs")
    else:
        print("[ERROR] Provide either --urls or --csv_file", file=sys.stderr)
        sys.exit(1)

    if not urls:
        print("[ERROR] No URLs found.")
        sys.exit(1)

    # Auth
    credentials = service_account.Credentials.from_service_account_file(
        args.service_account_file,
        scopes=["https://www.googleapis.com/auth/webmasters"]
    )

    total = len(urls)
    print(f"[INFO] GSC Property: {args.gsc_property}")
    print(f"[INFO] Checking {total} URL(s) with {MAX_WORKERS} concurrent workers...\n")

    results_by_index = {}
    done_count = 0
    lock = threading.Lock()
    thread_local = threading.local()
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_index = {
            executor.submit(inspect_url, thread_local, credentials, args.gsc_property, url): i
            for i, url in enumerate(urls)
        }

        for future in as_completed(future_to_index):
            index = future_to_index[future]
            url = urls[index]
            result = future.result()
            results_by_index[index] = result

            with lock:
                done_count += 1
                elapsed = int(time.time() - start_time)
                verdict = result["Verdict"]
                level = "ERROR" if result["Coverage State"] == "ERROR" else "INFO"
                print(f"[{level}] [{done_count}/{total}] {verdict} | {url} | {elapsed}s elapsed")
                print(f"[PROGRESS] done={done_count} queued={total - done_count} urls={total}")

    results = [results_by_index[i] for i in range(total)]

    pd.DataFrame(results).to_csv(args.output_file, index=False)

    indexed_count = sum(1 for r in results if r["Indexed"] == "Yes")
    not_indexed_count = total - indexed_count
    print(f"\n[SUMMARY] indexed={indexed_count} not_indexed={not_indexed_count} total={total}")
    print(f"[DONE] Report saved to: {os.path.abspath(args.output_file)}")


if __name__ == "__main__":
    main()
