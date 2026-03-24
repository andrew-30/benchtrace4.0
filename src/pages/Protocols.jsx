import { FlaskConical } from "lucide-react";

export default function Protocols() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <FlaskConical className="w-6 h-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Protocols</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        Protocol management is coming soon. You'll be able to create, version, and publish
        standard operating procedures here.
      </p>
    </div>
  );
}