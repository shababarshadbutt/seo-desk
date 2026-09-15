export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildUrlsetXml(urls: string[]): string {
  const body = urls.map((u) => `<url><loc>${escapeXml(u)}</loc></url>`).join("");
  return `<?xml version='1.0' encoding='utf-8'?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function buildSitemapIndexXml(domain: string, subfolder: string, filenames: string[], today: string): string {
  const domainBase = domain.replace(/\/+$/, "");
  const cleanSubfolder = subfolder.replace(/^\/+|\/+$/g, "");
  const body = filenames
    .map(
      (name) =>
        `<sitemap><loc>${escapeXml(`${domainBase}/${cleanSubfolder}/${name}`)}</loc><lastmod>${today}</lastmod></sitemap>`
    )
    .join("");
  return `<?xml version='1.0' encoding='utf-8'?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}
