import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Activity, FlaskConical, AlertTriangle, BarChart3, Clock } from "lucide-react";
import StatCard from "../components/StatCard";
import { base44 } from "@/api/base44Client";

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
  const navigate = useNavigate();
  const { org } = useOutletContext();
  const orgId = localStorage.getItem("bt_org_id");
  const [stats, setStats] = useState({ activeRuns: 0, protocols: 0, openDeviations: 0, runsThisMonth: 0 });

  useEffect(() => {
    async function loadStats() {
      const [runs, protocols, deviations] = await Promise.all([
        base44.entities.Run.filter({ organization_id: orgId }),
        base44.entities.Protocol.filter({ organization_id: orgId }),
        base44.entities.Deviation.filter({ organization_id: orgId, status: 'open', archived: false }),
      ]);
      const thisMonth = new Date();
      thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
      setStats({
        activeRuns: runs.filter(r => r.run_state === 'in_progress').length,
        protocols: protocols.length,
        openDeviations: deviations.length,
        runsThisMonth: runs.filter(r => r.run_started_at && new Date(r.run_started_at) >= thisMonth).length,
      });
    }
    if (orgId) loadStats();
  }, [orgId]);

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
        <StatCard label="Active Runs" value={String(stats.activeRuns)} icon={Activity} color="blue" />
        <StatCard label="Protocols" value={String(stats.protocols)} icon={FlaskConical} color="indigo" />
        <StatCard label="Open Deviations" value={String(stats.openDeviations)} icon={AlertTriangle} color="amber" />
        <StatCard label="Runs This Month" value={String(stats.runsThisMonth)} icon={BarChart3} color="green" />
        <div
          onClick={() => navigate('/audit-readiness')}
          style={{ cursor: 'pointer', padding: '20px', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: '3px solid #6366f1' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.12)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Audit Readiness</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6366f1' }}>Check Score →</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>5-point compliance check</div>
        </div>
        <div
          onClick={() => navigate('/traceability')}
          style={{ cursor: 'pointer', padding: '20px', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: '3px solid #1e293b' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(30,41,59,0.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Traceability</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b' }}>Search →</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Track lots across all runs</div>
        </div>
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