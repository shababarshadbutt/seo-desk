import { LastmodUpdaterClient } from "./lastmod-updater-client";

export default function LastmodUpdaterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Lastmod Updater</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pull a domain&apos;s sitemaps from SFTP, S3, or a live URL, bump &lt;lastmod&gt; on the files you choose, and push
          straight back to S3.
        </p>
      </div>

      <LastmodUpdaterClient />
    </div>
  );
}
