import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, User } from "lucide-react";

function useDeviceType() {
  const [device, setDevice] = useState(() => { const w = window.innerWidth; return { isMobile: w < 768, isTablet: w >= 768 && w < 1200 }; });
  useEffect(() => {
    const update = () => { const w = window.innerWidth; setDevice({ isMobile: w < 768, isTablet: w >= 768 && w < 1200 }); };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return device;
}
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const FILTER_TABS = ["All", "In Progress", "Completed", "Abandoned"];

const STATE_STYLES = {
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  signed: "bg-primary/10 text-primary border border-primary/20",
  abandoned: "bg-slate-100 text-slate-500 border border-slate-200",
  not_started: "bg-gray-100 text-gray-500 border border-gray-200",
};

const STATE_LABELS = {
  in_progress: "In Progress",
  completed: "Completed",
  signed: "Signed",
  abandoned: "Abandoned",
  not_started: "Not Started",
};

const RESULT_STYLES = {
  pass:      { className: 'bg-emerald-50 text-emerald-700', label: 'PASS' },
  fail:      { className: 'bg-red-50 text-red-700',         label: 'FAIL' },
  pending:   { className: 'bg-gray-100 text-gray-500',      label: 'PENDING' },
  abandoned: { className: 'bg-slate-100 text-slate-400',    label: 'ABANDONED' },
  void:      { className: 'bg-gray-100 text-gray-400',      label: 'VOID' },
};

function fmtTs(iso) {
  if (!iso) return "—";
  const tz = localStorage.getItem("bt_tz") || "UTC";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const diff = Math.floor((new Date(endIso) - new Date(startIso)) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Runs() {
  const navigate = useNavigate();
  const device = useDeviceType();
  const orgId = localStorage.getItem("bt_org_id");
  const [runs, setRuns] = useState([]);
  const [protocols, setProtocols] = useState({});
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [runsData, protsData] = await Promise.all([
        base44.entities.Run.filter({ organization_id: orgId }, "-run_started_at"),
        base44.entities.Protocol.filter({ organization_id: orgId }),
      ]);
      const protMap = {};
      for (const p of protsData) protMap[p.id] = p;
      setRuns(runsData);
      setProtocols(protMap);
      setLoading(false);
    }
    load();
  }, [orgId]);

  const filterMap = {
    "All": null,
    "In Progress": "in_progress",
    "Completed": "completed",
    "Abandoned": "abandoned",
  };

  const filtered = (filter === "All"
    ? runs
    : runs.filter(r => r.run_state === filterMap[filter]))
    .slice()
    .sort((a, b) => {
      if (a.run_state === 'in_progress' && b.run_state !== 'in_progress') return -1;
      if (b.run_state === 'in_progress' && a.run_state !== 'in_progress') return 1;
      return new Date(b.run_started_at) - new Date(a.run_started_at);
    });

  const activeRuns = filtered.filter(r => r.run_state === 'in_progress');

  return (
    <div className="space-y-6" style={{ paddingBottom: window.innerWidth < 768 ? 80 : 0 }}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Runs</h1>
        <Button size="sm" onClick={() => navigate("/protocols")}>
          <Activity className="w-4 h-4 mr-1.5" />
          Start New Run
        </Button>
      </div>

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {FILTER_TABS.map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No runs yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Select a protocol and start your first run.
          </p>
          <Button size="sm" className="mt-4" onClick={() => navigate("/protocols")}>
            Select Protocol
          </Button>
        </div>
      ) : (
        <div>
          {activeRuns.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'bt-pulse 1.5s infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Runs ({activeRuns.length})</span>
              </div>
              {activeRuns.map(run => (
                <div key={run.id} style={{ background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', border: '2px solid #3b82f6', borderRadius: 10, padding: '14px 16px', marginBottom: 8, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#3b82f6', animation: 'bt-pulse 1.5s infinite' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', animation: 'bt-pulse 1.5s infinite' }} />
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LIVE</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{protocols[run.protocol_id]?.name || 'Protocol Run'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{run.operator_name || '—'} · Started {run.run_started_at ? new Date(run.run_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                    </div>
                    <button onClick={() => navigate(`/run-execution?id=${run.id}`)} style={{ padding: '8px 18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }}>
                      ▶ Resume
                    </button>
                  </div>
                </div>
              ))}
              {filtered.filter(r => r.run_state !== 'in_progress').length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 16, marginBottom: 10 }}>All Runs</div>
              )}
            </div>
          )}
          <style>{`@keyframes bt-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          {/* Single card layout — all devices */}
          <div>
            {filtered.filter(r => r.run_state !== 'in_progress').map(run => (
              <div key={run.id}
                onClick={() => navigate(`/run-detail?id=${run.id}`)}
                style={{ background: 'white', borderRadius: 10, border: `1px solid ${run.run_state === 'signed' ? '#c7d2fe' : '#e2e8f0'}`, borderLeft: `3px solid ${run.run_state === 'signed' ? '#6366f1' : run.run_state === 'abandoned' ? '#94a3b8' : '#e2e8f0'}`, padding: '14px 16px', marginBottom: 8, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {protocols[run.protocol_id]?.name || 'Protocol Run'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {run.operator_name} · {new Date(run.run_started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: run.run_state === 'signed' ? '#eef2ff' : run.run_state === 'abandoned' ? '#f8fafc' : '#f8fafc', color: run.run_state === 'signed' ? '#6366f1' : '#94a3b8', border: `1px solid ${run.run_state === 'signed' ? '#c7d2fe' : '#e2e8f0'}` }}>
                      {run.run_state === 'signed' ? 'SIGNED' : run.run_state === 'completed' ? 'DONE' : run.run_state === 'abandoned' ? 'ABANDONED' : run.run_state.toUpperCase()}
                    </span>
                    {run.result_status && run.result_status !== 'pending' && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: run.result_status === 'pass' ? '#f0fdf4' : run.result_status === 'fail' ? '#fef2f2' : '#f8fafc', color: run.result_status === 'pass' ? '#16a34a' : run.result_status === 'fail' ? '#dc2626' : '#94a3b8', border: `1px solid ${run.result_status === 'pass' ? '#bbf7d0' : run.result_status === 'fail' ? '#fecaca' : '#e2e8f0'}` }}>
                        {run.result_status === 'pass' ? 'PASS' : run.result_status === 'fail' ? 'FAIL' : run.result_status === 'abandoned' ? 'ABD' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}