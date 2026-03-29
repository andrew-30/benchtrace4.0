import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

function fmtTs(iso) {
  if (!iso) return "—";
  const tz = localStorage.getItem("bt_tz") || "UTC";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(iso));
}

function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return "—";
  const diff = Math.floor((new Date(endIso) - new Date(startIso)) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const STATE_STYLES = {
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  signed: "bg-primary/10 text-primary border border-primary/20",
  abandoned: "bg-slate-100 text-slate-500 border border-slate-200",
};

const STATE_LABELS = {
  in_progress: "In Progress", completed: "Completed",
  signed: "Signed", abandoned: "Abandoned",
};

const EVENT_STYLES = {
  run_started: "bg-blue-50 text-blue-700",
  run_completed: "bg-emerald-50 text-emerald-700",
  run_abandoned: "bg-red-50 text-red-700",
  run_signed: "bg-primary/10 text-primary",
  step_completed: "bg-gray-100 text-gray-600",
};

function MetaRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export default function RunDetail() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const orgId = localStorage.getItem("bt_org_id");

  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get("id");

  const [run, setRun] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [stepRuns, setStepRuns] = useState([]);
  const [protocolSteps, setProtocolSteps] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [signingOff, setSigningOff] = useState(false);

  useEffect(() => {
    async function load() {
      if (!runId) { navigate("/runs"); return; }
      const runData = await base44.entities.Run.filter({ organization_id: orgId, id: runId });
      if (!runData || runData.length === 0) { navigate("/runs"); return; }
      const r = runData[0];
      setRun(r);

      const [protos, srs, steps, logs] = await Promise.all([
        base44.entities.Protocol.filter({ organization_id: orgId, id: r.protocol_id }),
        base44.entities.StepRun.filter({ organization_id: orgId, run_id: runId }, "step_order"),
        base44.entities.ProtocolStep.filter({ organization_id: orgId, protocol_id: r.protocol_id }, "step_order"),
        base44.entities.AuditLog.filter({ organization_id: orgId, entity_id: runId }, "-created_at"),
      ]);

      setProtocol(protos[0] || null);
      setStepRuns(srs);
      setProtocolSteps(steps);
      setAuditLogs(logs);
      setLoading(false);
    }
    load();
  }, [runId, orgId]);

  async function handleSignOff() {
    setSigningOff(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();

    await base44.entities.Run.update(run.id, {
      run_state: "signed",
      is_signed_off: true,
      signed_off_at: now,
      signed_off_by_user_id: user.id,
    });

    await base44.entities.AuditLog.create({
      organization_id: orgId,
      entity_type: "Run",
      entity_id: run.id,
      event_type: "run_signed",
      actor_user_id: user.id,
      actor_email: user.email,
      metadata: { signed_at: now },
      created_at: now,
    });

    setRun(p => ({ ...p, run_state: "signed", is_signed_off: true, signed_off_at: now }));
    setSigningOff(false);
    toast({ title: "Run signed off", description: "The run has been successfully signed." });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const mergedSteps = stepRuns.map(sr => ({
    ...protocolSteps.find(s => s.id === sr.step_id) || {},
    ...sr,
  }));

  const checklistEntries = run.checklist_completed ? Object.values(run.checklist_completed) : [];
  const verifiedCount = checklistEntries.filter(e => e?.verified).length;

  const shortId = run.id.slice(-8).toUpperCase();

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={() => navigate("/runs")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Runs
      </button>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{protocol?.name || "Unknown Protocol"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Run #{shortId} · Operator: {run.operator_name || "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Started: {fmtTs(run.run_started_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATE_STYLES[run.run_state] || "bg-gray-100 text-gray-600"}`}>
              {STATE_LABELS[run.run_state] || run.run_state}
            </span>
            {run.run_state === "in_progress" && (
              <Button size="sm" onClick={() => navigate(`/run-execution?id=${run.id}`)}>
                Resume Run
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {["overview", "steps", "audit"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "audit" ? "Audit Trail" : tab === "steps" ? `Steps (${stepRuns.length})` : "Overview"}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Run Details</h3>
            <MetaRow label="Started" value={fmtTs(run.run_started_at)} />
            <MetaRow label="Ended" value={fmtTs(run.run_ended_at)} />
            <MetaRow label="Duration" value={fmtDuration(run.run_started_at, run.run_ended_at)} />
            <MetaRow label="Operator" value={run.operator_name} />
            <MetaRow label="Sample Reference" value={run.sample_reference} />
            <MetaRow label="Instrument ID" value={run.instrument_id} />
            {run.temperature != null && (
              <MetaRow label="Temperature" value={`${run.temperature}°${run.temperature_unit === "fahrenheit" ? "F" : "C"}`} />
            )}
            {run.humidity != null && <MetaRow label="Humidity" value={`${run.humidity}%`} />}
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Result</h3>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-sm px-3 py-1 rounded-full font-semibold capitalize ${
                  run.result_status === "pass" ? "bg-emerald-50 text-emerald-700" :
                  run.result_status === "fail" ? "bg-red-50 text-red-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {run.result_status || "pending"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {mergedSteps.filter(s => s.deviation_flagged).length} deviation(s)
                </span>
              </div>

              {run.run_state === "completed" && !run.is_signed_off && (
                <Button className="w-full" onClick={handleSignOff} disabled={signingOff}>
                  {signingOff ? "Signing..." : "Sign Off Run"}
                </Button>
              )}
              {run.is_signed_off && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-emerald-600 font-semibold">✓ Signed off</p>
                  <p>At: {fmtTs(run.signed_off_at)}</p>
                </div>
              )}
            </div>

            {checklistEntries.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Pre-Run Checklist</h3>
                <p className="text-sm text-muted-foreground">{verifiedCount} of {checklistEntries.length} items verified</p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${checklistEntries.length > 0 ? (verifiedCount / checklistEntries.length) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {run.context_notes && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{run.context_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      {activeTab === "steps" && (
        <div className="space-y-3">
          {mergedSteps.map((s, i) => (
            <div key={s.id} className={`bg-card border rounded-lg p-4 ${s.deviation_flagged ? "border-amber-200" : "border-border"}`}>
              <div className="flex items-start gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  s.step_state === "completed" ? "bg-emerald-100 text-emerald-700" :
                  s.step_state === "skipped" ? "bg-amber-100 text-amber-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {s.step_state === "completed" ? "✓" : s.step_state === "skipped" ? "⏭" : s.step_order}
                </span>
                <div className="flex-1 min-w-0">
                  {s.title && <p className="text-xs font-semibold text-primary uppercase mb-1">{s.title}</p>}
                  <p className="text-sm text-foreground leading-relaxed">{s.instruction}</p>

                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {s.step_completed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtTs(s.step_completed_at)}
                      </span>
                    )}
                    {s.timer_elapsed_seconds != null && s.expected_duration_seconds > 0 && (
                      <span className={`font-medium ${
                        Math.abs(s.timer_elapsed_seconds - s.expected_duration_seconds) > (s.tolerance_upper_seconds || 0)
                          ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {Math.floor(s.timer_elapsed_seconds / 60)}m {s.timer_elapsed_seconds % 60}s
                        {" "}(target: {Math.floor(s.expected_duration_seconds / 60)}m)
                      </span>
                    )}
                    {s.deviation_flagged && (
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Deviation
                      </span>
                    )}
                  </div>

                  {s.measurement_values && Object.keys(s.measurement_values).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(s.measurement_values).map(([k, v]) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {s.notes && (
                    <p className="mt-2 text-xs text-muted-foreground italic bg-muted/40 rounded px-2 py-1">{s.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Trail */}
      {activeTab === "audit" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No audit entries yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap mt-0.5 ${EVENT_STYLES[log.event_type] || "bg-gray-100 text-gray-600"}`}>
                    {log.event_type?.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{log.actor_email}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtTs(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}