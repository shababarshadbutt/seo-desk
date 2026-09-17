import { LastmodUpdaterClient } from "./lastmod-updater-client";

export default function LastmodUpdaterPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-bold">Lastmod Updater</h2>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            v1.0.0 Engine
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Pull a domain&apos;s sitemaps from SFTP, S3, or a live URL, bump &lt;lastmod&gt; on the files you choose, and push
          straight back to S3.
        </p>
      </div>

      <LastmodUpdaterClient />
    </div>
  );
}
