import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, User } from "lucide-react";
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
  pass: "bg-emerald-50 text-emerald-700",
  fail: "bg-red-50 text-red-700",
  pending: "bg-gray-100 text-gray-500",
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
    <div className="space-y-6">
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
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Protocol</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">State</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Operator</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Started</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Result</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(run => (
                  <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{protocols[run.protocol_id]?.name || "Unknown Protocol"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATE_STYLES[run.run_state] || STATE_STYLES.not_started}`}>
                        {STATE_LABELS[run.run_state] || run.run_state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{run.operator_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{fmtTs(run.run_started_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{fmtDuration(run.run_started_at, run.run_ended_at) || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${RESULT_STYLES[run.result_status] || RESULT_STYLES.pending}`}>
                        {run.result_status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {run.run_state === "in_progress" ? (
                        <Button size="sm" onClick={() => navigate(`/run-execution?id=${run.id}`)}>Resume</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/run-detail?id=${run.id}`)}>View</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}