import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePlan } from "@/lib/PlanContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tzFmt(dateStr, timeOnly = false) {
  if (!dateStr) return "—";
  const tz = localStorage.getItem("bt_tz") || "UTC";
  try {
    const opts = timeOnly
      ? { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
      : { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
    return new Intl.DateTimeFormat("en-GB", opts).format(new Date(dateStr));
  } catch (e) { return dateStr; }
}

function fmtRelative(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDuration(startStr, endStr) {
  if (!startStr || !endStr) return "—";
  const totalSec = Math.floor((new Date(endStr) - new Date(startStr)) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtElapsed(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StateBadge({ state }) {
  const cfg = {
    in_progress: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "In Progress" },
    completed:   { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Completed" },
    signed:      { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe", label: "Signed" },
    abandoned:   { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: "Abandoned" },
  };
  const c = cfg[state] || cfg.completed;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const cfg = {
    high:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "HIGH" },
    medium: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "MED" },
    low:    { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: "LOW" },
  };
  const c = cfg[severity] || cfg.low;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function AuditBadge({ eventType }) {
  const cfg = {
    run_started:        { bg: "#eff6ff", color: "#1d4ed8" },
    step_completed:     { bg: "#f0fdf4", color: "#16a34a" },
    run_completed:      { bg: "#eef2ff", color: "#4338ca" },
    run_signed:         { bg: "#eef2ff", color: "#4338ca" },
    deviation_created:  { bg: "#fffbeb", color: "#d97706" },
    deviation_resolved: { bg: "#f0fdf4", color: "#16a34a" },
    run_abandoned:      { bg: "#f8fafc", color: "#64748b" },
  };
  const c = cfg[eventType] || { bg: "#f8fafc", color: "#64748b" };
  const label = (eventType || "").replace(/_/g, " ");
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.color, textTransform: "capitalize" }}>
      {label}
    </span>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function AddDeviationForm({ stepRun, onSave, onCancel }) {
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState("low");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!desc.trim()) return;
    setSaving(true);
    await onSave(stepRun, desc, severity);
    setSaving(false);
  }

  return (
    <div style={{ padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>LOG DEVIATION — Step {stepRun.step_order}</div>
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Describe what happened..."
        rows={3}
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #fde68a", borderRadius: 6, fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Severity:</label>
        {["low", "medium", "high"].map(s => (
          <button key={s} onClick={() => setSeverity(s)}
            style={{ padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", background: severity === s ? (s === "high" ? "#dc2626" : s === "medium" ? "#d97706" : "#64748b") : "#e2e8f0", color: severity === s ? "white" : "#64748b" }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "6px 14px", background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#475569" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={!desc.trim() || saving}
          style={{ padding: "6px 16px", background: !desc.trim() || saving ? "#94a3b8" : "#d97706", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: !desc.trim() || saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving..." : "Log Deviation"}
        </button>
      </div>
    </div>
  );
}

// ─── ESignatureModal ─────────────────────────────────────────────────────────
function ESignatureModal({ run, protocol, stepRuns, deviations, onSign, onClose, signing }) {
  const [result, setResult] = useState('');
  const [intentConfirmed, setIntentConfirmed] = useState(false);
  const [statement, setStatement] = useState('I certify that all steps were completed as per the protocol and results are accurately recorded.');
  const [currentUser, setCurrentUser] = useState(null);
  const [resultError, setResultError] = useState('');

  const STATEMENTS = [
    'I certify that all steps were completed as per the protocol and results are accurately recorded.',
    'I confirm that this run was executed under controlled conditions and all deviations have been documented.',
    'I verify that the data recorded in this run is accurate and complete to the best of my knowledge.',
  ];

  useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => {});
  }, []);

  const totalSteps = (stepRuns || []).length;
  const completedSteps = (stepRuns || []).filter(s => s.step_state === 'completed').length;
  const openDeviations = (deviations || []).filter(d => d.status === 'open' && !d.archived).length;
  const resolvedDeviations = (deviations || []).filter(d => d.status === 'resolved' && !d.archived).length;
  const totalDeviations = openDeviations + resolvedDeviations;
  const measurementSteps = (stepRuns || []).filter(s => s.measurement_values && Object.keys(s.measurement_values).length > 0);
  const allResolved = openDeviations === 0;
  const canSign = result !== '' && intentConfirmed;

  function handleApply() {
    if (!result) { setResultError('Please select Pass or Fail before signing.'); return; }
    if (!intentConfirmed) return;
    onSign({ result, signerName: currentUser?.full_name || currentUser?.email || 'Unknown', signerEmail: currentUser?.email || '', statement });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, fontFamily: 'system-ui, sans-serif', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🔏</span>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'white' }}>Electronic Sign-Off</div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>21 CFR Part 11 compliant · Permanent · Cryptographically hashed</div>
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Run Summary */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Run Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Protocol</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>{protocol?.name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Operator</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{run?.operator_name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Steps Completed</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: completedSteps === totalSteps ? '#16a34a' : '#d97706' }}>{completedSteps}/{totalSteps}</span>
                  {completedSteps === totalSteps && <span style={{ fontSize: 11, color: '#16a34a' }}>✓</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Deviations</div>
                {totalDeviations === 0 ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>None ✓</span>
                ) : allResolved ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{totalDeviations} resolved ✓</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{openDeviations} open ⚠</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Measurements</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{measurementSteps.length} recorded</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Run Date</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                  {run?.run_started_at ? new Date(run.run_started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
            {openDeviations > 0 && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                ⚠ {openDeviations} open deviation{openDeviations > 1 ? 's' : ''} — consider resolving before signing
              </div>
            )}
          </div>

          {/* Step 1 — Quality Decision */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Step 1 — Quality Decision <span style={{ color: '#ef4444' }}>*</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>Based on your review of this run, what is your quality decision?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setResult('pass'); setResultError(''); }}
                style={{ flex: 1, padding: '14px 12px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${result === 'pass' ? '#16a34a' : '#e2e8f0'}`, background: result === 'pass' ? '#f0fdf4' : 'white', transition: 'all 0.15s', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: result === 'pass' ? '#16a34a' : '#374151' }}>PASS</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4, marginTop: 4 }}>Results acceptable for use or release</div>
              </button>
              <button onClick={() => { setResult('fail'); setResultError(''); }}
                style={{ flex: 1, padding: '14px 12px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${result === 'fail' ? '#dc2626' : '#e2e8f0'}`, background: result === 'fail' ? '#fef2f2' : 'white', transition: 'all 0.15s', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>✗</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: result === 'fail' ? '#dc2626' : '#374151' }}>FAIL</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4, marginTop: 4 }}>Results rejected — investigation required</div>
              </button>
            </div>
            {resultError && <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{resultError}</div>}
          </div>

          {/* Step 2 — Identity */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Step 2 — Your Identity</div>
            <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{currentUser?.full_name || currentUser?.email || 'Loading...'}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{currentUser?.email || ''}</div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>✓ Identity verified via BenchTrace session</div>
              </div>
              <div style={{ padding: '3px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 99 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4338ca' }}>VERIFIED</span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', background: intentConfirmed ? '#eef2ff' : '#f8fafc', border: `1px solid ${intentConfirmed ? '#c7d2fe' : '#e2e8f0'}`, borderRadius: 8, transition: 'all 0.15s' }}>
                <input type="checkbox" checked={intentConfirmed} onChange={e => setIntentConfirmed(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, cursor: 'pointer', flexShrink: 0, accentColor: '#6366f1' }} />
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  I confirm this signature represents my <strong>intentional and informed</strong> approval of this run result. I have reviewed the run data and accept responsibility for this sign-off.
                </span>
              </label>
            </div>
          </div>

          {/* Step 3 — Certification Statement */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Step 3 — Certification Statement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STATEMENTS.map((s, i) => (
                <button key={i} onClick={() => setStatement(s)}
                  style={{ padding: '10px 12px', borderRadius: 7, cursor: 'pointer', textAlign: 'left', border: `1px solid ${statement === s ? '#c7d2fe' : '#e2e8f0'}`, background: statement === s ? '#eef2ff' : 'white', fontSize: 12, color: statement === s ? '#4338ca' : '#475569', lineHeight: 1.5 }}>
                  <span style={{ marginRight: 6, fontWeight: 800 }}>{statement === s ? '◉' : '○'}</span>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Legal notice */}
          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 20, fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
            By clicking "Apply Electronic Signature" you are applying a legally binding electronic signature. This action is <strong>permanent</strong>, time-stamped, and <strong>cannot be undone</strong>. A SHA-256 cryptographic hash will be generated as proof of this signature.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onMouseDown={onClose} disabled={signing}
              style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={handleApply} disabled={!canSign || signing}
              style={{ flex: 2, padding: '12px', background: !canSign || signing ? '#94a3b8' : result === 'pass' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: !canSign || signing ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
              {signing ? 'Applying signature...' : !result ? 'Select Pass or Fail to continue' : !intentConfirmed ? 'Confirm your intent to continue' : `Apply ${result === 'pass' ? 'PASS' : 'FAIL'} Signature 🔏`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RunDetail() {
  const navigate = useNavigate();
  const { canAccess, isBeta, switchPreviewPlan } = usePlan();
  const orgId = localStorage.getItem("bt_org_id");
  const runId = new URLSearchParams(window.location.search).get("id");

  const [run, setRun] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [mergedSteps, setMergedSteps] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentUser, setCurrentUser] = useState(null);
  const [isOperator, setIsOperator] = useState(false);

  // Sign-off state
  const [showESignModal, setShowESignModal] = useState(false);
  const [signing, setSigning] = useState(false);

  // Deviation state
  const [addDeviationStepId, setAddDeviationStepId] = useState(null);

  useEffect(() => {
    async function load() {
      if (!runId) { navigate("/runs"); return; }
      const user = await base44.auth.me();
      setCurrentUser(user);

      const [runData, stepRunsData, devsData, logsData] = await Promise.all([
        base44.entities.Run.filter({ organization_id: orgId, id: runId }),
        base44.entities.StepRun.filter({ organization_id: orgId, run_id: runId }),
        base44.entities.Deviation.filter({ organization_id: orgId, run_id: runId }),
        base44.entities.AuditLog.filter({ organization_id: orgId }),
      ]);

      if (!runData || runData.length === 0) { navigate("/runs"); return; }
      const r = runData[0];
      setRun(r);
      setIsOperator(r.operator_user_id === user.id);
      setDeviations(devsData || []);

      const proto = await base44.entities.Protocol.filter({ organization_id: orgId, id: r.protocol_id });
      setProtocol(proto?.[0] || null);

      const [stepsData, checklistData] = await Promise.all([
        base44.entities.ProtocolStep.filter({ organization_id: orgId, protocol_id: r.protocol_id }),
        base44.entities.ProtocolChecklistItem.filter({ organization_id: orgId, protocol_id: r.protocol_id }),
      ]);
      setChecklistItems((checklistData || []).sort((a, b) => (a.item_order || 0) - (b.item_order || 0)));

      const merged = (stepRunsData || [])
        .sort((a, b) => a.step_order - b.step_order)
        .map(sr => ({
          ...stepsData.find(s => s.id === sr.step_id),
          ...sr,
          stepRunId: sr.id,
        }));
      setMergedSteps(merged);

      // Filter logs to this run
      const stepRunIds = new Set((stepRunsData || []).map(sr => sr.id));
      const devIds = new Set((devsData || []).map(d => d.id));
      const filtered = (logsData || []).filter(l =>
        l.entity_id === runId ||
        (l.entity_type === "StepRun" && stepRunIds.has(l.entity_id)) ||
        (l.entity_type === "Deviation" && devIds.has(l.entity_id))
      ).sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));
      setAuditLogs(filtered);

      setLoading(false);
    }
    load();
  }, [runId, orgId]);

  async function handleSignOff({ result, signerName, signerEmail, statement }) {
    setSigning(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    let signatureHash = '';
    try {
      const hashInput = `${run.id}|${signerName}|${signerEmail}|${result}|${now}|${statement}`;
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
      signatureHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) {
      signatureHash = `fallback-${Date.now()}`;
    }
    await base44.entities.Run.update(run.id, {
      run_state: 'signed', is_signed_off: true, signed_off_at: now,
      signed_off_by_user_id: user.id, signed_off_by_name: signerName,
      result_status: result, signature_hash: signatureHash,
    });
    await base44.entities.AuditLog.create({
      organization_id: orgId, entity_type: 'Run', entity_id: run.id,
      event_type: 'run_signed', actor_user_id: user.id, actor_email: user.email,
      metadata: { result_status: result, signed_at: now, signed_by_name: signerName, signer_email: signerEmail, certification_statement: statement, signature_hash: signatureHash, cfr_part_11: true },
      created_at: now,
    });
    setRun(prev => ({ ...prev, run_state: 'signed', is_signed_off: true, result_status: result, signed_off_by_name: signerName, signed_off_at: now, signature_hash: signatureHash }));
    setShowESignModal(false);
    setSigning(false);
  }

  async function handleAddDeviation(stepRun, description, severity) {
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    const deviation = await base44.entities.Deviation.create({
      organization_id: orgId, run_id: run.id, step_run_id: stepRun.stepRunId,
      step_order: stepRun.step_order, step_instruction: stepRun.instruction,
      description: description.trim(), deviation_type: "operator_noted",
      severity, status: "open", created_by_id: user.id, created_at: now, archived: false,
    });
    await base44.entities.AuditLog.create({
      organization_id: orgId, entity_type: "Deviation", entity_id: deviation.id,
      event_type: "deviation_created", actor_user_id: user.id, actor_email: user.email,
      metadata: { step_order: stepRun.step_order, severity, run_id: run.id }, created_at: now,
    });
    setDeviations(prev => [...prev, deviation]);
    setAddDeviationStepId(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const completedCount = mergedSteps.filter(s => s.step_state === "completed" || s.step_state === "skipped").length;
  const openDevs = deviations.filter(d => d.status === "open");
  const resolvedDevs = deviations.filter(d => d.status === "resolved");

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={() => navigate("/runs")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Runs
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
            {protocol?.name || "Protocol"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Run #{(run.id || "").slice(-8).toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <StateBadge state={run.run_state} />
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Operator: <strong>{run.operator_name || "—"}</strong>
              {isOperator && <span style={{ color: '#6366f1', marginLeft: 4 }}>(you)</span>}
            </span>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {tzFmt(run.run_started_at)}
            </span>
          </div>
        </div>
        {['completed', 'signed'].includes(run?.run_state) && (
          <button
            onClick={() => navigate(`/audit-view?run_id=${run.id}`)}
            style={{ padding: '7px 14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            🔍 Audit View
          </button>
        )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {["overview", "steps", "audit"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "audit" ? "Audit Trail" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "steps" && ` (${mergedSteps.length})`}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Metadata grid */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Run Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              <MetaRow label="Started" value={tzFmt(run.run_started_at)} />
              <MetaRow label="Ended" value={run.run_ended_at ? tzFmt(run.run_ended_at) : "—"} />
              <MetaRow label="Duration" value={run.run_ended_at ? fmtDuration(run.run_started_at, run.run_ended_at) : "In progress"} />
              <MetaRow label="Operator" value={run.operator_name} />
              <MetaRow label="Sample Ref" value={run.sample_reference} />
              <MetaRow label="Instrument" value={run.instrument_id} />
              <MetaRow label="Temperature" value={run.temperature ? `${run.temperature}°${run.temperature_unit === "fahrenheit" ? "F" : "C"}` : null} />
              <MetaRow label="Humidity" value={run.humidity != null ? `${run.humidity}%` : null} />
            </div>
            {run.context_notes && (
              <div style={{ marginTop: 14, padding: "10px 12px", background: "#f8fafc", borderRadius: 7, fontSize: 13, color: "#475569" }}>
                <span style={{ fontWeight: 700, color: "#64748b" }}>Notes: </span>{run.context_notes}
              </div>
            )}
          </div>

          {/* Materials Used */}
          {checklistItems.length > 0 && run.checklist_completed && (() => {
            const getExpiryStatus = (expiryDateStr) => {
              if (!expiryDateStr) return null;
              const expiry = new Date(expiryDateStr);
              const daysUntil = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
              if (daysUntil < 0) return { type: "expired", label: `Expired ${Math.abs(daysUntil)}d ago`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
              if (daysUntil <= 7) return { type: "critical", label: `Expires in ${daysUntil}d`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
              if (daysUntil <= 30) return { type: "warning", label: `Expires in ${daysUntil}d`, color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
              return { type: "ok", label: `Exp: ${new Date(expiryDateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" };
            };
            const CATEGORY_CONFIG = {
              safety:    { label: "Safety",    icon: "🛡", color: "#dc2626", border: "#fecaca", leftBorder: "#ef4444" },
              equipment: { label: "Equipment", icon: "⚙️",  color: "#1d4ed8", border: "#bfdbfe", leftBorder: "#3b82f6" },
              reagent:   { label: "Reagents",  icon: "🧪", color: "#16a34a", border: "#bbf7d0", leftBorder: "#10b981" },
              other:     { label: "Other",     icon: "📋", color: "#475569", border: "#e2e8f0", leftBorder: "#94a3b8" },
            };
            const total = checklistItems.length;
            const verifiedCount = checklistItems.filter(item => run.checklist_completed[item.id]?.verified).length;
            const withLot = checklistItems.filter(item => run.checklist_completed[item.id]?.lot_number).length;
            const expired = checklistItems.filter(item => { const exp = run.checklist_completed[item.id]?.expiry_date; return exp && new Date(exp) < new Date(); }).length;
            return (
              <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  🧪 Materials Used in This Run
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, textTransform: "none" }}>— captured at run start</span>
                </div>
                {["safety", "equipment", "reagent", "other"].map(category => {
                  const categoryItems = checklistItems.filter(i => i.category === category);
                  if (categoryItems.length === 0) return null;
                  const cfg = CATEGORY_CONFIG[category];
                  return (
                    <div key={category} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        {cfg.icon} {cfg.label} ({categoryItems.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {categoryItems.map(item => {
                          const itemState = run.checklist_completed[item.id] || {};
                          const expiryStatus = getExpiryStatus(itemState.expiry_date);
                          const verified = itemState.verified;
                          return (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "white", border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.leftBorder}`, borderRadius: 7 }}>
                              <span style={{ fontSize: 14, flexShrink: 0, color: verified ? "#16a34a" : "#94a3b8" }}>{verified ? "✓" : "○"}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: verified ? "#1e293b" : "#94a3b8", fontWeight: verified ? 500 : 400 }}>
                                  {item.item_text}
                                  {!verified && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6, fontStyle: "italic" }}>not verified</span>}
                                </div>
                                {verified && (itemState.lot_number || itemState.expiry_date) && (
                                  <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                                    {itemState.lot_number && (
                                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 4, background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>Lot: {itemState.lot_number}</span>
                                    )}
                                    {expiryStatus && (
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: expiryStatus.bg, color: expiryStatus.color, border: `1px solid ${expiryStatus.border}` }}>
                                        {expiryStatus.type === "expired" ? "🚫" : expiryStatus.type === "ok" ? "✓" : "⚠️"} {expiryStatus.label}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {verified && !itemState.lot_number && !itemState.expiry_date && category !== "safety" && (
                                <span style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic", flexShrink: 0 }}>no lot recorded</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#475569" }}><strong style={{ color: "#1e293b" }}>{verifiedCount}/{total}</strong> items verified</span>
                  <span style={{ fontSize: 11, color: "#475569" }}><strong style={{ color: "#1e293b" }}>{withLot}</strong> lot numbers recorded</span>
                  {expired > 0 && <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠ {expired} expired item{expired > 1 ? "s" : ""} used</span>}
                </div>
              </div>
            );
          })()}

          {/* Progress summary */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Progress</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Steps Completed</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>{completedCount} <span style={{ fontSize: 13, color: "#94a3b8" }}>/ {mergedSteps.length}</span></div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Deviations</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: openDevs.length > 0 ? "#dc2626" : "#16a34a" }}>
                  {openDevs.length > 0 ? `${openDevs.length} open` : "None"}{resolvedDevs.length > 0 ? `, ${resolvedDevs.length} resolved` : ""}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Result</div>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                  background: run.result_status === "pass" ? "#f0fdf4" : run.result_status === "fail" ? "#fef2f2" : "#f8fafc",
                  color: run.result_status === "pass" ? "#16a34a" : run.result_status === "fail" ? "#dc2626" : "#64748b",
                  border: `1px solid ${run.result_status === "pass" ? "#bbf7d0" : run.result_status === "fail" ? "#fecaca" : "#e2e8f0"}`
                }}>
                  {(run.result_status || "pending").toUpperCase()}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 14, height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#6366f1", borderRadius: 99, width: `${mergedSteps.length > 0 ? (completedCount / mergedSteps.length) * 100 : 0}%`, transition: "width 0.4s" }} />
            </div>
          </div>

          {/* Open deviations summary */}
          {openDevs.length > 0 && (
            <div style={{ background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a", borderLeft: "4px solid #d97706", padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>⚠ Open Deviations ({openDevs.length})</div>
              {openDevs.map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, padding: "8px 10px", background: "white", borderRadius: 7, border: "1px solid #fde68a" }}>
                  <SeverityBadge severity={d.severity} />
                  <div>
                    <div style={{ fontSize: 12, color: "#1e293b", fontWeight: 500 }}>{d.description}</div>
                    {d.step_order && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Step {d.step_order}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sign-off section */}
          {run.run_state === 'completed' && (
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #c7d2fe', padding: '20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Ready to Sign Off</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Review the run and apply your 21 CFR Part 11 electronic signature.</div>
              {canAccess('esignature') ? (
                isOperator ? (
                  <div style={{ padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>🔒 Sign-off requires a different operator</div>
                    <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>21 CFR Part 11 requires separation of duties. You executed this run, so another team member or supervisor must sign it off.</div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowESignModal(true)}
                    style={{ padding: '10px 22px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    🔏 Sign Off Run
                  </button>
                )
              ) : (
                <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>🔒 21 CFR Part 11 E-Signature</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: isBeta ? 8 : 0 }}>Available on Lab Pro (€249/month)</div>
                  {isBeta && (
                    <button
                      onClick={() => switchPreviewPlan('lab_pro')}
                      style={{ padding: '6px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Preview as Lab Pro →
                    </button>
                  )}
                </div>
              )}

            </div>
          )}

          {showESignModal && (
            <ESignatureModal
              run={run}
              protocol={protocol}
              stepRuns={mergedSteps}
              deviations={deviations}
              onSign={handleSignOff}
              onClose={() => setShowESignModal(false)}
              signing={signing}
            />
          )}

          {run.run_state === 'signed' && (
            <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>Run signed off</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                  By <strong>{run.signed_off_by_name || run.signed_off_by_user_id || "Unknown"}</strong>
                  {run.signed_off_at && <span> on {tzFmt(run.signed_off_at)}</span>}
                </div>
                {run.result_status && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: run.result_status === 'pass' ? '#f0fdf4' : run.result_status === 'fail' ? '#fef2f2' : '#fffbeb', color: run.result_status === 'pass' ? '#16a34a' : run.result_status === 'fail' ? '#dc2626' : '#d97706', border: `1px solid ${run.result_status === 'pass' ? '#bbf7d0' : run.result_status === 'fail' ? '#fecaca' : '#fde68a'}` }}>
                      Result: {run.result_status === 'pass' ? '✓ Pass' : run.result_status === 'fail' ? '✗ Fail' : '— Pending'}
                    </span>
                  </div>
                )}
                {run.signature_hash && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Cryptographic Signature Hash (SHA-256)</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all' }}>{run.signature_hash}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>21 CFR Part 11 compliant electronic signature</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {run.run_state === 'abandoned' && (
            <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #94a3b8', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Run Abandoned</div>
              <div style={{ fontSize: 13, color: '#475569' }}>{run.context_notes || 'No reason recorded'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Ended: {run.run_ended_at ? new Date(run.run_ended_at).toLocaleString('en-GB') : '—'}</div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: STEPS ──────────────────────────────────────────────────────── */}
      {activeTab === "steps" && (
        <div>
          {(() => {
            const rendered = [];
            let lastTitle = null;
            mergedSteps.forEach((step, idx) => {
              const title = step.title?.trim() || null;
              if (title && title !== lastTitle) {
                rendered.push(
                  <div key={`hdr_${idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", marginTop: idx === 0 ? 0 : 12 }}>
                    <div style={{ flex: 1, height: 1, background: "#e0e7ff" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.07em", padding: "2px 10px", background: "#eef2ff", borderRadius: 99 }}>{title}</span>
                    <div style={{ flex: 1, height: 1, background: "#e0e7ff" }} />
                  </div>
                );
                lastTitle = title;
              }

              const stepDevs = deviations.filter(d => d.step_run_id === step.stepRunId);
              const stateIcon = step.step_state === "completed" ? "✓" : step.step_state === "skipped" ? "⏭" : "●";
              const stateColor = step.step_state === "completed" ? "#16a34a" : step.step_state === "skipped" ? "#f59e0b" : "#94a3b8";

              // Timer check
              let timerStatus = null;
              if (step.timing_mode !== "none" && step.expected_duration_seconds > 0 && step.timer_elapsed_seconds != null) {
                const lower = step.expected_duration_seconds - (step.tolerance_lower_seconds || 0);
                const upper = step.expected_duration_seconds + (step.tolerance_upper_seconds || 0);
                if (step.timer_elapsed_seconds >= lower && step.timer_elapsed_seconds <= upper) {
                  timerStatus = { ok: true, label: "✓ On time" };
                } else if (step.timer_elapsed_seconds < lower) {
                  timerStatus = { ok: false, label: "⚠ Under time" };
                } else {
                  timerStatus = { ok: false, label: "⚠ Over time" };
                }
              }

              rendered.push(
                <div key={step.stepRunId} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 6, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: step.is_critical ? "#ef4444" : "#6366f1", color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      {step.step_order}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: stateColor }}>{stateIcon}</span>
                        <span style={{ fontSize: 13, color: "#1e293b", lineHeight: "1.5", flex: 1 }}>{step.instruction}</span>
                      </div>

                      {/* Meta row */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                        {step.step_completed_at && (
                          <span>Completed: <strong style={{ color: "#64748b" }}>{tzFmt(step.step_completed_at)}</strong></span>
                        )}
                        {step.timer_elapsed_seconds != null && (
                          <span>Took: <strong style={{ color: "#64748b" }}>{fmtElapsed(step.timer_elapsed_seconds)}</strong>
                            {step.expected_duration_seconds > 0 && <span> / target {fmtElapsed(step.expected_duration_seconds)}</span>}
                          </span>
                        )}
                        {timerStatus && (
                          <span style={{ fontWeight: 700, color: timerStatus.ok ? "#16a34a" : "#d97706" }}>{timerStatus.label}</span>
                        )}
                        {step.deviation_flagged && (
                          <span style={{ fontWeight: 700, color: "#dc2626" }}>⚠ Deviation flagged</span>
                        )}
                      </div>

                      {/* Measurements */}
                      {step.measurement_values && Object.keys(step.measurement_values).length > 0 && (
                        <div style={{ marginTop: 8, padding: "8px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>MEASUREMENTS</div>
                          {Object.entries(step.measurement_values).map(([k, v]) => (
                            <div key={k} style={{ fontSize: 12, color: "#1e293b" }}><span style={{ color: "#64748b" }}>{k}:</span> {v}</div>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {step.notes && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>{step.notes}</div>
                      )}

                      {/* Step deviations */}
                      {stepDevs.map(d => (
                        <div key={d.id} style={{ marginTop: 6, padding: "6px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e", display: "flex", gap: 6, alignItems: "center" }}>
                          <SeverityBadge severity={d.severity} />
                          <span>{d.description}</span>
                          {d.status === "resolved" && <span style={{ color: "#16a34a", marginLeft: 4 }}>✓ Resolved</span>}
                        </div>
                      ))}

                      {/* Add deviation */}
                      {(step.step_state === "completed" || step.step_state === "skipped") && addDeviationStepId !== step.stepRunId && (
                        <button onClick={() => setAddDeviationStepId(step.stepRunId)}
                          style={{ marginTop: 8, padding: "4px 12px", background: "white", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#d97706" }}>
                          + Log Deviation
                        </button>
                      )}
                      {addDeviationStepId === step.stepRunId && (
                        <AddDeviationForm stepRun={step} onSave={handleAddDeviation} onCancel={() => setAddDeviationStepId(null)} />
                      )}
                    </div>
                  </div>
                </div>
              );
            });
            return rendered;
          })()}
        </div>
      )}

      {/* ── TAB: AUDIT TRAIL ────────────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div>
          {auditLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: 13 }}>No audit entries for this run.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {auditLogs.map(log => {
                const ts = log.created_at || log.created_date;
                const isMe = currentUser && log.actor_email === currentUser.email;
                return (
                  <div key={log.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <AuditBadge eventType={log.event_type} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>
                        {isMe ? "You" : (log.actor_email || "System")}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {Object.entries(log.metadata).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "#1e293b", fontWeight: 500 }}>{tzFmt(ts)}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmtRelative(ts)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}