import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import FeatureGate from "@/components/FeatureGate";

function useDeviceType() {
  const [device, setDevice] = useState(() => { const w = window.innerWidth; return { isMobile: w < 768 }; });
  useEffect(() => {
    const update = () => { const w = window.innerWidth; setDevice({ isMobile: w < 768 }); };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return device;
}

function tzFmt(dateStr) {
  if (!dateStr) return "—";
  const tz = localStorage.getItem("bt_tz") || "UTC";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(new Date(dateStr));
  } catch (e) { return dateStr; }
}

function SeverityBadge({ severity }) {
  const cfg = {
    high:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "HIGH" },
    medium: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "MEDIUM" },
    low:    { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: "LOW" },
  };
  const c = cfg[severity] || cfg.low;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const labels = {
    timer_exceeded: "Timer Exceeded",
    timer_short: "Timer Short",
    measurement_out_of_range: "Out of Range",
    operator_noted: "Operator Noted",
    other: "Other",
  };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#f1f5f9", color: "#475569" }}>
      {labels[type] || type}
    </span>
  );
}

function ResolveForm({ deviationId, onResolve, onCancel }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await onResolve(deviationId, notes);
    setSaving(false);
  }

  return (
    <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#14532d", marginBottom: 8 }}>RESOLUTION NOTES</div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Describe how this was resolved..."
        rows={3}
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "6px 14px", background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#475569" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: "6px 16px", background: saving ? "#94a3b8" : "#16a34a", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Resolving..." : "Mark Resolved"}
        </button>
      </div>
    </div>
  );
}

export default function Deviations() {
  const navigate = useNavigate();
  const device = useDeviceType();
  const orgId = localStorage.getItem("bt_org_id");

  const [deviations, setDeviations] = useState([]);
  const [runs, setRuns] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    async function load() {
      const [devs, runsData, protos] = await Promise.all([
        base44.entities.Deviation.filter({ organization_id: orgId, archived: false }),
        base44.entities.Run.filter({ organization_id: orgId }),
        base44.entities.Protocol.filter({ organization_id: orgId }),
      ]);
      setDeviations(devs || []);
      setRuns(runsData || []);
      setProtocols(protos || []);
      setLoading(false);
    }
    load();
  }, [orgId]);

  async function handleResolve(deviationId, resolutionNotes) {
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    await base44.entities.Deviation.update(deviationId, {
      status: "resolved", resolution_notes: resolutionNotes.trim(),
      resolved_by_user_id: user.id, resolved_by_name: user.full_name || user.email, resolved_at: now,
    });
    await base44.entities.AuditLog.create({
      organization_id: orgId, entity_type: "Deviation", entity_id: deviationId,
      event_type: "deviation_resolved", actor_user_id: user.id, actor_email: user.email,
      metadata: { resolution_notes: resolutionNotes, resolved_at: now }, created_at: now,
    });
    setDeviations(prev => prev.map(d => d.id === deviationId
      ? { ...d, status: "resolved", resolution_notes: resolutionNotes, resolved_at: now }
      : d
    ));
    setResolvingId(null);
  }

  const getRunContext = (dev) => {
    const run = runs.find(r => r.id === dev.run_id);
    if (!run) return null;
    const proto = protocols.find(p => p.id === run.protocol_id);
    return { run, proto };
  };

  const filtered = deviations
    .filter(d => statusFilter === "all" || d.status === statusFilter)
    .filter(d => severityFilter === "all" || d.severity === severityFilter)
    .sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));

  const openCount = deviations.filter(d => d.status === "open").length;
  const highCount = deviations.filter(d => d.severity === "high").length;
  const resolvedCount = deviations.filter(d => d.status === "resolved").length;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FeatureGate feature="deviation_center">
    <div className="space-y-4 max-w-4xl" style={{ paddingBottom: window.innerWidth < 768 ? 80 : 0 }}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground mb-1">Deviations</h1>
        <p className="text-sm text-muted-foreground">Track and resolve protocol deviations across all runs.</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total", value: deviations.length, color: "#1e293b" },
          { label: "Open", value: openCount, color: "#dc2626" },
          { label: "High Severity", value: highCount, color: "#d97706" },
          { label: "Resolved", value: resolvedCount, color: "#16a34a" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "open", "resolved"].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              style={{ padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: statusFilter === f ? "#6366f1" : "#f1f5f9", color: statusFilter === f ? "white" : "#64748b", textTransform: "capitalize" }}>
              {f === "all" ? "All Status" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "high", "medium", "low"].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              style={{ padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                background: severityFilter === s ? (s === "high" ? "#dc2626" : s === "medium" ? "#d97706" : s === "low" ? "#64748b" : "#6366f1") : "#f1f5f9",
                color: severityFilter === s ? "white" : "#64748b", textTransform: "capitalize" }}>
              {s === "all" ? "All Severity" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            {deviations.length === 0 ? "No deviations recorded" : "No deviations match your filters"}
          </div>
          <div style={{ fontSize: 12 }}>
            {deviations.length === 0 ? "Deviations are auto-flagged during runs or can be logged manually from the Run Detail page." : "Try adjusting your filters."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(dev => {
            const ctx = getRunContext(dev);
            const isOpen = dev.status === "open";
            return (
              <div key={dev.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: device.isMobile ? "14px 16px" : "14px 16px", minHeight: device.isMobile ? 72 : 'auto', borderLeft: `4px solid ${dev.severity === "high" ? "#dc2626" : dev.severity === "medium" ? "#d97706" : "#94a3b8"}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      <SeverityBadge severity={dev.severity} />
                      <TypeBadge type={dev.deviation_type} />
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: isOpen ? "#fef2f2" : "#f0fdf4", color: isOpen ? "#dc2626" : "#16a34a" }}>
                        {isOpen ? "OPEN" : "RESOLVED"}
                      </span>
                    </div>
                    <div style={{ fontSize: device.isMobile ? 13 : 13, color: "#1e293b", fontWeight: 600, marginBottom: 6 }}>{dev.description}</div>
                    {dev.step_order && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        Step {dev.step_order}{dev.step_instruction ? ` — ${dev.step_instruction.substring(0, 60)}${dev.step_instruction.length > 60 ? "…" : ""}` : ""}
                      </div>
                    )}
                    {ctx && (
                      <button onClick={() => navigate(`/run-detail?id=${dev.run_id}`)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#6366f1", fontWeight: 600, padding: 0, textDecoration: "underline" }}>
                        {ctx.proto?.name || "Protocol"} — {tzFmt(ctx.run?.run_started_at)}
                      </button>
                    )}
                    {dev.status === "resolved" && dev.resolution_notes && (
                      <div style={{ marginTop: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#16a34a" }}>
                        ✓ Resolved: {dev.resolution_notes}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{tzFmt(dev.created_at || dev.created_date)}</div>
                    {isOpen && resolvingId !== dev.id && (
                      <button onClick={() => setResolvingId(dev.id)}
                        style={{ padding: device.isMobile ? '8px 14px' : '5px 14px', minHeight: device.isMobile ? 36 : 28, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#16a34a" }}>
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
                {resolvingId === dev.id && (
                  <ResolveForm deviationId={dev.id} onResolve={handleResolve} onCancel={() => setResolvingId(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </FeatureGate>
  );
}