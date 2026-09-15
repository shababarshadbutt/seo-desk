import { SitemapCleanerClient } from "./sitemap-cleaner-client";

export default function SitemapCleanerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sitemap Cleaner</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pull sitemaps from an upload, SFTP, S3, or a live URL, remove duplicate/wrong-domain URLs and rebuild the
          index, then download a ZIP or push the cleaned files straight back to S3.
        </p>
      </div>

      <SitemapCleanerClient />
    </div>
  );
}
