import { Activity } from "lucide-react";

export default function Runs() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
        <Activity className="w-6 h-6 text-blue-600" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Runs</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        Run execution is coming soon. You'll be able to start, track, and sign off on
        protocol runs with full audit trails.
      </p>
    </div>
  );
}