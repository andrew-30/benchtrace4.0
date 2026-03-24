export default function StatCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-primary/10 text-primary",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  const iconBg = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-card rounded-lg border border-border p-5 flex items-start gap-4 transition-shadow hover:shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}