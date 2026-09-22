import { SitemapCleanerClient } from "./sitemap-cleaner-client";
import packageJson from "@/package.json";

export default function SitemapCleanerPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-bold">Sitemap Cleaner</h2>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            v{packageJson.version} Engine
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Pull sitemaps from an upload, SFTP, S3, or a live URL, remove duplicate/wrong-domain URLs and rebuild the
          index, then download a ZIP or push the cleaned files straight back to S3.
        </p>
      </div>

      <SitemapCleanerClient />
    </div>
  );
}
