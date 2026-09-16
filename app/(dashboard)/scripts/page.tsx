import { scripts } from "@/lib/scripts-config";
import { ScriptsListClient } from "@/components/scripts-list-client";

export default function ScriptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scripts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {scripts.length} scripts available. Click <strong>Run script</strong> to open the execution form.
        </p>
      </div>

      <ScriptsListClient />
    </div>
  );
}
