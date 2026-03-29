import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, ChevronLeft, SkipForward, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtSec(sec) {
  const s = Math.abs(sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── AbandonModal — top level function declaration ────────────────────────────
function AbandonModal({ onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#1e293b", borderRadius: 12, padding: 28, maxWidth: 420, width: "100%",
        border: "1px solid #334155",
      }}>
        <h3 style={{ color: "#ef4444", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Abandon Run</h3>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          This run will be marked as abandoned. This action cannot be undone.
        </p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
          REASON FOR ABANDONMENT *
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe why this run is being abandoned..."
          style={{
            width: "100%", minHeight: 90, background: "#0f172a", border: "1px solid #334155",
            borderRadius: 8, padding: "10px 12px", color: "white", fontSize: 14,
            resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onCancel}
            style={{
              flex: 1, padding: "10px", background: "transparent", border: "1px solid #334155",
              borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 14,
            }}>
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim() || loading}
            style={{
              flex: 2, padding: "10px", background: reason.trim() && !loading ? "#ef4444" : "#7f1d1d",
              border: "none", borderRadius: 8, color: "white", cursor: reason.trim() && !loading ? "pointer" : "not-allowed",
              fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1,
            }}>
            {loading ? "Abandoning..." : "Confirm Abandon"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TimerBox ─────────────────────────────────────────────────────────────────
function TimerBox({ step, elapsed }) {
  const target = step.expected_duration_seconds || 0;
  if (!target || step.timing_mode === "none") return null;

  const isStrict = step.timing_mode === "strict";
  const remaining = target - elapsed;
  const isOvertime = remaining < 0;
  const progress = Math.min(elapsed / target, 1.5);

  const barColor = progress >= 1 ? "#ef4444" : progress >= 0.8 ? "#f59e0b" : "#6366f1";

  const tolLower = step.tolerance_lower_seconds || 0;
  const tolUpper = step.tolerance_upper_seconds || 0;
  const withinTol = isStrict
    ? elapsed >= (target - tolLower) && elapsed <= (target + tolUpper)
    : true;

  return (
    <div style={{
      border: `1px solid ${isStrict ? "#7f1d1d" : "#1e3a5f"}`,
      borderRadius: 10, padding: "14px 18px", marginBottom: 18,
      background: isStrict ? "rgba(239,68,68,0.06)" : "rgba(99,102,241,0.06)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: isStrict ? "#ef4444" : "#818cf8", marginBottom: 8 }}>
        {isStrict ? "🔴 STRICT TIMER" : "⏱ ADVISORY TIMER"}
      </div>
      <div style={{
        fontFamily: "monospace", fontSize: 40, fontWeight: 700, letterSpacing: 2,
        color: isOvertime ? "#ef4444" : "white", marginBottom: 8,
      }}>
        {isOvertime ? `+${fmtSec(-remaining)}` : fmtSec(remaining)}
      </div>
      <div style={{ height: 6, background: "#1e293b", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99, background: barColor,
          width: `${Math.min(progress * 100, 100)}%`, transition: "width 1s linear",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
        <span>Target: {fmtSec(target)}</span>
        {isStrict && (tolLower > 0 || tolUpper > 0) && (
          <span style={{ color: withinTol ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
            {withinTol ? `✓ within ±${Math.max(tolLower, tolUpper) / 60}m` : `⚠ outside window`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── StepSidebarItem ──────────────────────────────────────────────────────────
function StepSidebarItem({ merged, isCurrent, onClick }) {
  const stateIcon = {
    completed: <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>,
    skipped: <span style={{ color: "#f59e0b" }}>⏭</span>,
    active: <span style={{ color: "#6366f1" }}>→</span>,
    pending: <span style={{ color: "#475569" }}>●</span>,
  };

  return (
    <div
      onClick={() => (merged.step_state === "completed" || merged.step_state === "skipped") && onClick()}
      style={{
        padding: "10px 12px", borderRadius: 8, marginBottom: 4, cursor:
          merged.step_state === "completed" || merged.step_state === "skipped" ? "pointer" : "default",
        background: isCurrent ? "rgba(99,102,241,0.15)" : "transparent",
        border: isCurrent ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
        transition: "all 0.15s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", width: 20, flexShrink: 0 }}>
          {merged.step_order}
        </span>
        <span style={{ flexShrink: 0 }}>{stateIcon[merged.step_state] || stateIcon.pending}</span>
        <span style={{
          fontSize: 12, color: isCurrent ? "white" : "#94a3b8",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {(merged.instruction || "").substring(0, 48)}{(merged.instruction || "").length > 48 ? "…" : ""}
        </span>
      </div>
      {merged.timing_mode && merged.timing_mode !== "none" && merged.expected_duration_seconds > 0 && (
        <div style={{ marginTop: 4, marginLeft: 28 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
            background: merged.timing_mode === "strict" ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
            color: merged.timing_mode === "strict" ? "#f87171" : "#818cf8",
          }}>
            ⏱ {Math.round(merged.expected_duration_seconds / 60)}m
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RunExecution() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem("bt_org_id");

  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get("id");

  const [run, setRun] = useState(null);
  const [mergedSteps, setMergedSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [stepNotes, setStepNotes] = useState("");
  const [measurementValues, setMeasurementValues] = useState({});
  const [stepElapsed, setStepElapsed] = useState(0);
  const [runElapsed, setRunElapsed] = useState(0);

  const [showAbandon, setShowAbandon] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const stepTimerRef = useRef(null);
  const runTimerRef = useRef(null);

  useEffect(() => {
    async function load() {
      if (!runId) { navigate("/runs"); return; }
      const [runData, stepRunsData] = await Promise.all([
        base44.entities.Run.filter({ organization_id: orgId, id: runId }),
        base44.entities.StepRun.filter({ organization_id: orgId, run_id: runId }, "step_order"),
      ]);
      if (!runData || runData.length === 0) { navigate("/runs"); return; }
      const r = runData[0];

      const stepsData = await base44.entities.ProtocolStep.filter({
        organization_id: orgId,
        protocol_id: r.protocol_id,
      }, "step_order");

      const merged = stepRunsData.map(sr => ({
        ...steps_find(stepsData, sr.step_id),
        ...sr,
        stepRunId: sr.id,
      })).sort((a, b) => a.step_order - b.step_order);

      setRun(r);
      setMergedSteps(merged);

      // Find first non-completed step
      const firstPending = merged.findIndex(s => s.step_state === "pending" || s.step_state === "active");
      setCurrentStepIndex(firstPending >= 0 ? firstPending : 0);

      // Run elapsed
      if (r.run_started_at) {
        const startSec = Math.floor((Date.now() - new Date(r.run_started_at)) / 1000);
        setRunElapsed(startSec);
      }

      setLoading(false);
    }
    load();
  }, [runId, orgId]);

  function steps_find(stepsArr, stepId) {
    return stepsArr.find(s => s.id === stepId) || {};
  }

  // Run elapsed timer
  useEffect(() => {
    if (!run) return;
    runTimerRef.current = setInterval(() => setRunElapsed(p => p + 1), 1000);
    return () => clearInterval(runTimerRef.current);
  }, [run]);

  // Step timer
  useEffect(() => {
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    setStepElapsed(0);
    const currentStep = mergedSteps[currentStepIndex];
    if (currentStep?.timing_mode !== "none" && currentStep?.expected_duration_seconds > 0) {
      stepTimerRef.current = setInterval(() => setStepElapsed(p => p + 1), 1000);
    }
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
  }, [currentStepIndex, mergedSteps.length]);

  const currentStep = mergedSteps[currentStepIndex];

  async function handleCompleteStep() {
    if (!currentStep || currentStep.step_state === "completed" || completing) return;
    setCompleting(true);

    const user = await base44.auth.me();
    const now = new Date().toISOString();

    let deviationFlagged = false;
    if (currentStep.timing_mode === "strict" && currentStep.expected_duration_seconds > 0) {
      const lower = currentStep.expected_duration_seconds - (currentStep.tolerance_lower_seconds || 0);
      const upper = currentStep.expected_duration_seconds + (currentStep.tolerance_upper_seconds || 0);
      if (stepElapsed < lower || stepElapsed > upper) deviationFlagged = true;
    }
    if (currentStep.measurement_parameters?.length > 0) {
      for (const param of currentStep.measurement_parameters) {
        const val = measurementValues[param.name];
        if (val != null) {
          if ((param.min_value != null && val < param.min_value) ||
              (param.max_value != null && val > param.max_value)) {
            deviationFlagged = true;
          }
        }
      }
    }

    await base44.entities.StepRun.update(currentStep.stepRunId, {
      step_state: "completed",
      step_completed_at: now,
      timer_elapsed_seconds: stepElapsed,
      measurement_values: measurementValues,
      notes: stepNotes,
      deviation_flagged: deviationFlagged,
    });

    await base44.entities.AuditLog.create({
      organization_id: orgId,
      entity_type: "StepRun",
      entity_id: currentStep.stepRunId,
      event_type: "step_completed",
      actor_user_id: user.id,
      actor_email: user.email,
      metadata: { step_order: currentStep.step_order, elapsed: stepElapsed, deviation_flagged: deviationFlagged },
      created_at: now,
    });

    // Update local state
    const updated = mergedSteps.map((s, i) =>
      i === currentStepIndex ? { ...s, step_state: "completed", deviation_flagged: deviationFlagged } : s
    );
    setMergedSteps(updated);

    const isLast = currentStepIndex >= mergedSteps.length - 1;
    if (isLast) {
      await base44.entities.Run.update(runId, { run_state: "completed", run_ended_at: now });
      await base44.entities.AuditLog.create({
        organization_id: orgId,
        entity_type: "Run",
        entity_id: runId,
        event_type: "run_completed",
        actor_user_id: user.id,
        actor_email: user.email,
        metadata: { total_steps: mergedSteps.length },
        created_at: now,
      });
      navigate(`/run-detail?id=${runId}`);
      return;
    }

    setCurrentStepIndex(p => p + 1);
    setStepNotes("");
    setMeasurementValues({});
    setStepElapsed(0);
    setCompleting(false);
  }

  async function handleSkipStep() {
    if (!currentStep) return;
    const user = await base44.auth.me();
    const now = new Date().toISOString();

    await base44.entities.StepRun.update(currentStep.stepRunId, {
      step_state: "skipped",
      step_completed_at: now,
    });

    const updated = mergedSteps.map((s, i) =>
      i === currentStepIndex ? { ...s, step_state: "skipped" } : s
    );
    setMergedSteps(updated);
    setShowSkipConfirm(false);

    const isLast = currentStepIndex >= mergedSteps.length - 1;
    if (isLast) {
      await base44.entities.Run.update(runId, { run_state: "completed", run_ended_at: now });
      navigate(`/run-detail?id=${runId}`);
      return;
    }
    setCurrentStepIndex(p => p + 1);
    setStepNotes("");
    setMeasurementValues({});
    setStepElapsed(0);
  }

  async function handleAbandon(reason) {
    setAbandoning(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();

    await base44.entities.Run.update(runId, {
      run_state: "abandoned",
      run_ended_at: now,
      context_notes: reason,
    });

    await base44.entities.AuditLog.create({
      organization_id: orgId,
      entity_type: "Run",
      entity_id: runId,
      event_type: "run_abandoned",
      actor_user_id: user.id,
      actor_email: user.email,
      metadata: { reason },
      created_at: now,
    });

    navigate(`/run-detail?id=${runId}`);
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading run...</p>
        </div>
      </div>
    );
  }

  const completedCount = mergedSteps.filter(s => s.step_state === "completed" || s.step_state === "skipped").length;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0f172a", color: "white",
      display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 50,
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>
            {run?.protocol_id && "RUN IN PROGRESS"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Elapsed:</span>
            <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#6366f1" }}>
              {fmtElapsed(runElapsed)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowAbandon(true)}
            style={{
              padding: "6px 14px", background: "transparent", border: "1px solid #7f1d1d",
              borderRadius: 7, color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>
            ⚠ Abandon
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {currentStep ? (
            <>
              {/* Step header */}
              <div style={{ marginBottom: 16 }}>
                {currentStep.title && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 1, marginBottom: 6 }}>
                    {currentStep.title.toUpperCase()}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                    background: "rgba(99,102,241,0.15)", color: "#818cf8",
                  }}>
                    Step {currentStep.step_order} of {mergedSteps.length}
                  </span>
                  {currentStep.is_critical && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                      background: "rgba(239,68,68,0.15)", color: "#f87171",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      ⚠ Critical
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 18, lineHeight: 1.7, color: "white", whiteSpace: "pre-line", fontWeight: 400 }}>
                  {currentStep.instruction}
                </p>
              </div>

              {/* Timer */}
              <TimerBox step={currentStep} elapsed={stepElapsed} />

              {/* Measurement inputs */}
              {currentStep.measurement_parameters && currentStep.measurement_parameters.length > 0 && (
                <div style={{
                  background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 10, padding: "14px 18px", marginBottom: 18,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>📏 MEASUREMENTS</div>
                  {currentStep.measurement_parameters.map((param, i) => {
                    const val = measurementValues[param.name] ?? "";
                    const numVal = parseFloat(val);
                    const outOfRange = val !== "" && !isNaN(numVal) && (
                      (param.min_value != null && numVal < param.min_value) ||
                      (param.max_value != null && numVal > param.max_value)
                    );
                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                          {param.name.toUpperCase()}{param.unit ? ` (${param.unit})` : ""}{param.required ? " *" : ""}
                        </label>
                        <input
                          type="number"
                          value={val}
                          onChange={e => setMeasurementValues(p => ({ ...p, [param.name]: e.target.value === "" ? undefined : parseFloat(e.target.value) }))}
                          style={{
                            width: "100%", padding: "10px 14px",
                            background: outOfRange ? "rgba(239,68,68,0.1)" : "#1e293b",
                            border: `1px solid ${outOfRange ? "#ef4444" : "#334155"}`,
                            borderRadius: 8, color: "white", fontSize: 16, fontWeight: 600,
                            outline: "none", boxSizing: "border-box",
                          }}
                          placeholder="Enter value..."
                        />
                        {(param.min_value != null || param.max_value != null) && (
                          <div style={{ fontSize: 11, color: outOfRange ? "#f87171" : "#64748b", marginTop: 4 }}>
                            {outOfRange ? "⚠ Out of range — " : ""}
                            Expected: {param.min_value ?? "—"} – {param.max_value ?? "—"} {param.unit || ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <textarea
                  value={stepNotes}
                  onChange={e => setStepNotes(e.target.value)}
                  placeholder="Step notes (optional)..."
                  style={{
                    width: "100%", minHeight: 72, background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 8, padding: "10px 14px", color: "#94a3b8", fontSize: 14,
                    resize: "none", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {currentStepIndex > 0 && (
                  <button
                    onClick={() => setCurrentStepIndex(p => p - 1)}
                    style={{
                      padding: "10px 16px", background: "transparent", border: "1px solid #334155",
                      borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                    }}>
                    ← Previous
                  </button>
                )}
                {!showSkipConfirm ? (
                  <button
                    onClick={() => setShowSkipConfirm(true)}
                    style={{
                      padding: "10px 16px", background: "rgba(245,158,11,0.1)", border: "1px solid #78350f",
                      borderRadius: 8, color: "#f59e0b", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    }}>
                    ⏭ Skip Step
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleSkipStep}
                      style={{ padding: "10px 14px", background: "#78350f", border: "none", borderRadius: 8, color: "#f59e0b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      Confirm Skip
                    </button>
                    <button onClick={() => setShowSkipConfirm(false)}
                      style={{ padding: "10px 14px", background: "transparent", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  onClick={handleCompleteStep}
                  disabled={completing}
                  style={{
                    flex: 1, padding: "12px 24px",
                    background: completing ? "#3730a3" : "#6366f1",
                    border: "none", borderRadius: 8, color: "white",
                    cursor: completing ? "not-allowed" : "pointer",
                    fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  {completing ? "Saving..." : currentStepIndex >= mergedSteps.length - 1 ? "✓ Complete Run" : "✓ Complete Step"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", paddingTop: 80, color: "#94a3b8" }}>
              <p>All steps completed.</p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{
          width: 280, background: "#0a0f1e", borderLeft: "1px solid #1e293b",
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>STEPS</div>
            <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
              {completedCount} / {mergedSteps.length} complete
            </div>
            <div style={{ height: 3, background: "#1e293b", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "#6366f1", borderRadius: 99,
                width: `${mergedSteps.length > 0 ? (completedCount / mergedSteps.length) * 100 : 0}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
            {mergedSteps.map((s, i) => (
              <StepSidebarItem
                key={s.stepRunId}
                merged={s}
                isCurrent={i === currentStepIndex}
                onClick={() => setCurrentStepIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {showAbandon && (
        <AbandonModal
          onConfirm={handleAbandon}
          onCancel={() => setShowAbandon(false)}
          loading={abandoning}
        />
      )}
    </div>
  );
}