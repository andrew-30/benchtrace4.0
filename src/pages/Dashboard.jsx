import { useOutletContext } from "react-router-dom";
import { Activity, FlaskConical, AlertTriangle, BarChart3, Clock } from "lucide-react";
import StatCard from "../components/StatCard";

function SectorBadge({ sector }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      {sector}
    </span>
  );
}

function PlanBadge({ plan }) {
  const labels = { free: "Free", pro: "Pro", team: "Team", lab_pro: "Lab Pro" };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      {labels[plan] || plan}
    </span>
  );
}

export default function Dashboard() {
  const { org } = useOutletContext();

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {org?.name || "Your Lab"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lab dashboard — compliance-first protocol execution
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SectorBadge sector={org?.sector || "General"} />
            <PlanBadge plan={org?.plan || "free"} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Runs" value="0" icon={Activity} color="blue" />
        <StatCard label="Protocols" value="0" icon={FlaskConical} color="indigo" />
        <StatCard label="Open Deviations" value="0" icon={AlertTriangle} color="amber" />
        <StatCard label="Runs This Month" value="0" icon={BarChart3} color="green" />
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activity will appear here as you create protocols and start runs.
          </p>
        </div>
      </div>
    </div>
  );
}