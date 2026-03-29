import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ArrowLeft, Clock, GripVertical, Plus, Play, Tag,
  Shield, Beaker, Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

// ─── Utilities ────────────────────────────────────────────────────────────────
function secToHMS(sec) {
  if (!sec) return { h: 0, m: 0, s: 0 };
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

function hmsToSec(h, m, s) {
  return (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
}

// ─── MeasurementEditor ────────────────────────────────────────────────────────
function MeasurementEditor({ step, onSave, onCancel }) {
  const [params, setParams] = useState(
    step.measurement_parameters && step.measurement_parameters.length > 0
      ? step.measurement_parameters.map(p => ({ ...p }))
      : [{ name: "", unit: "", min_value: "", max_value: "", required: true }]
  );
  const [saving, setSaving] = useState(false);

  function addParam() {
    setParams(prev => [...prev, { name: "", unit: "", min_value: "", max_value: "", required: true }]);
  }
  function removeParam(idx) {
    setParams(prev => prev.filter((_, i) => i !== idx));
  }
  function updateParam(idx, field, value) {
    setParams(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }
  async function handleSave() {
    setSaving(true);
    const cleaned = params
      .filter(p => p.name.trim().length > 0)
      .map(p => ({
        name: p.name.trim(),
        unit: p.unit.trim() || "",
        min_value: p.min_value !== "" && p.min_value != null ? parseFloat(p.min_value) : null,
        max_value: p.max_value !== "" && p.max_value != null ? parseFloat(p.max_value) : null,
        required: p.required !== false,
      }));
    await onSave(step.id, cleaned);
    setSaving(false);
  }

  const inputStyle = { width: "100%", padding: "5px 7px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box", background: "white" };

  return (
    <div style={{ marginTop: 10, padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 10 }}>📏 MEASUREMENT PARAMETERS</div>
      {params.map((param, idx) => (
        <div key={idx} style={{ background: "white", borderRadius: 7, padding: 10, marginBottom: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>PARAMETER NAME *</label>
              <input value={param.name} placeholder="e.g. A260/A280 ratio" onChange={e => updateParam(idx, "name", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>UNIT</label>
              <input value={param.unit} placeholder="e.g. ng/µL" onChange={e => updateParam(idx, "unit", e.target.value)} style={inputStyle} />
            </div>
            <button onClick={() => removeParam(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, paddingTop: 18, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>MIN VALUE</label>
              <input type="number" value={param.min_value ?? ""} placeholder="—" onChange={e => updateParam(idx, "min_value", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>MAX VALUE</label>
              <input type="number" value={param.max_value ?? ""} placeholder="—" onChange={e => updateParam(idx, "max_value", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 14 }}>
              <input type="checkbox" id={`req_${idx}`} checked={param.required !== false} onChange={e => updateParam(idx, "required", e.target.checked)} />
              <label htmlFor={`req_${idx}`} style={{ fontSize: 11, color: "#475569", cursor: "pointer" }}>Required</label>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addParam} style={{ width: "100%", padding: "7px", background: "white", border: "1px dashed #bbf7d0", borderRadius: 7, fontSize: 12, color: "#16a34a", fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>+ Add Parameter</button>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: "7px", background: "white", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, cursor: "pointer", color: "#475569" }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || params.every(p => !p.name.trim())} style={{ flex: 2, padding: "7px", background: "#16a34a", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "✓ Save Parameters"}
        </button>
      </div>
    </div>
  );
}

// ─── TimerEditor ──────────────────────────────────────────────────────────────
function TimerEditor({ step, onSave, onCancel, saving }) {
  const initial = secToHMS(step.expected_duration_seconds);
  const [h, setH] = useState(initial.h);
  const [m, setM] = useState(initial.m);
  const [s, setS] = useState(initial.s);
  const [mode, setMode] = useState(step.timing_mode !== "none" ? step.timing_mode : "advisory");
  const [tolLower, setTolLower] = useState(step.tolerance_lower_seconds ? Math.floor(step.tolerance_lower_seconds / 60) : 0);
  const [tolUpper, setTolUpper] = useState(step.tolerance_upper_seconds ? Math.floor(step.tolerance_upper_seconds / 60) : 0);

  const totalSeconds = hmsToSec(h, m, s);

  function setQuick(sec) {
    const v = secToHMS(sec);
    setH(v.h); setM(v.m); setS(v.s);
  }

  const QUICK = [
    { label: "30s", sec: 30 }, { label: "1m", sec: 60 }, { label: "2m", sec: 120 },
    { label: "5m", sec: 300 }, { label: "10m", sec: 600 }, { label: "30m", sec: 1800 }, { label: "1h", sec: 3600 },
  ];

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={99} value={h} onChange={e => setH(e.target.value)} className="w-14 text-center border border-input rounded px-2 py-1 text-sm bg-card" placeholder="HH" />
          <span className="text-muted-foreground text-xs">h</span>
        </div>
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={59} value={m} onChange={e => setM(e.target.value)} className="w-14 text-center border border-input rounded px-2 py-1 text-sm bg-card" placeholder="MM" />
          <span className="text-muted-foreground text-xs">m</span>
        </div>
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={59} value={s} onChange={e => setS(e.target.value)} className="w-14 text-center border border-input rounded px-2 py-1 text-sm bg-card" placeholder="SS" />
          <span className="text-muted-foreground text-xs">s</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {QUICK.map(q => (
          <button key={q.label} onClick={() => setQuick(q.sec)} className="text-xs px-2 py-1 rounded bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">{q.label}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mode:</span>
        <button onClick={() => setMode("advisory")} className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${mode === "advisory" ? "bg-blue-100 text-blue-700" : "bg-card border border-border text-muted-foreground"}`}>Advisory</button>
        <button onClick={() => setMode("strict")} className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${mode === "strict" ? "bg-red-100 text-red-700" : "bg-card border border-border text-muted-foreground"}`}>Strict</button>
      </div>
      {mode === "strict" && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 }}>TOLERANCE WINDOW</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>EARLY BY (min)</label>
              <input type="number" min="0" max="60" value={tolLower} onChange={e => setTolLower(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, textAlign: "center", fontWeight: 600, boxSizing: "border-box" }} />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", paddingTop: 16 }}>←→</div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>LATE BY (min)</label>
              <input type="number" min="0" max="60" value={tolUpper} onChange={e => setTolUpper(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, textAlign: "center", fontWeight: 600, boxSizing: "border-box" }} />
            </div>
          </div>
          {totalSeconds > 0 && (tolLower > 0 || tolUpper > 0) && (
            <div style={{ marginTop: 8, padding: "5px 10px", background: "#fef2f2", borderRadius: 6, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
              Acceptable window: {(() => {
                const lower = totalSeconds - tolLower * 60;
                const upper = totalSeconds + tolUpper * 60;
                const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
                return `${fmt(Math.max(0, lower))} → ${fmt(upper)}`;
              })()}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" disabled={saving || totalSeconds <= 0} onClick={() => totalSeconds > 0 && onSave(step.id, mode, totalSeconds, tolLower * 60, tolUpper * 60)}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── StepCard ─────────────────────────────────────────────────────────────────
function StepCard({
  step, index, isAdmin,
  onTimerSave, onTimerRemove,
  editingMeasurementsStepId, setEditingMeasurementsStepId, onMeasurementSave,
  onDelete, onDuplicate, onToggleCritical,
  editingStepId, setEditingStepId,
  editingStepTitle, setEditingStepTitle,
  editingStepInstruction, setEditingStepInstruction,
  onSaveStepEdit,
}) {
  const [showTimer, setShowTimer] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const hasTimer = step.timing_mode && step.timing_mode !== "none" && step.expected_duration_seconds;
  const isEditingMeasurements = editingMeasurementsStepId === step.id;
  const isEditingStep = editingStepId === step.id;

  async function handleTimerSave(stepId, timingMode, durationSeconds, toleranceLower, toleranceUpper) {
    setTimerSaving(true);
    await onTimerSave(stepId, timingMode, durationSeconds, toleranceLower, toleranceUpper);
    setTimerSaving(false);
    setShowTimer(false);
  }

  return (
    <Draggable draggableId={step.id} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps}
          className={`bg-card border rounded-lg p-4 ${step.is_critical ? "border-red-200" : "border-border"}`}>
          <div className="flex items-start gap-3">
            {isAdmin && (
              <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab">
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-start gap-2 mb-2">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {step.step_order}
                </span>
                {!isEditingStep && step.title && (
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide mt-0.5">{step.title}</span>
                )}
                <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
                  {/* Critical toggle */}
                  {isAdmin ? (
                    <button
                      onClick={() => onToggleCritical(step)}
                      title={step.is_critical ? "Click to unmark critical" : "Click to mark critical"}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                        cursor: "pointer",
                        background: step.is_critical ? "#fef2f2" : "#f8fafc",
                        color: step.is_critical ? "#dc2626" : "#94a3b8",
                        border: `1px solid ${step.is_critical ? "#fecaca" : "#e2e8f0"}`,
                        transition: "all 0.15s",
                      }}>
                      {step.is_critical ? "⚠ CRITICAL" : "⚠ mark critical"}
                    </button>
                  ) : (
                    step.is_critical && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>⚠ CRITICAL</span>
                    )
                  )}
                  {/* Timer badge */}
                  {hasTimer && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                      background: step.timing_mode === "strict" ? "#fef2f2" : "#eff6ff",
                      color: step.timing_mode === "strict" ? "#dc2626" : "#1d4ed8",
                      border: `1px solid ${step.timing_mode === "strict" ? "#fecaca" : "#bfdbfe"}`,
                    }}>
                      ⏱ {step.expected_duration_seconds >= 3600
                        ? `${Math.floor(step.expected_duration_seconds / 3600)}h${Math.floor((step.expected_duration_seconds % 3600) / 60) > 0 ? ` ${Math.floor((step.expected_duration_seconds % 3600) / 60)}m` : ""}`
                        : step.expected_duration_seconds >= 60
                        ? `${Math.floor(step.expected_duration_seconds / 60)}m`
                        : `${step.expected_duration_seconds}s`}
                    </span>
                  )}
                  {/* Duplicate & delete */}
                  {isAdmin && (
                    <>
                      <button onClick={() => onDuplicate(step)} title="Duplicate step"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 13, padding: "2px 6px", borderRadius: 4, flexShrink: 0, opacity: 0.6 }}
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.6}>
                        ⧉
                      </button>
                      <button onClick={() => onDelete(step.id)} title="Delete step"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, padding: "2px 6px", borderRadius: 4, flexShrink: 0, opacity: 0.6 }}
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.6}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Instruction — editable or static */}
              {isEditingStep ? (
                <div style={{ marginTop: 6 }}>
                  <input
                    value={editingStepTitle}
                    onChange={e => setEditingStepTitle(e.target.value)}
                    placeholder="Step title (optional)"
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 12, marginBottom: 6, boxSizing: "border-box", fontWeight: 600 }}
                  />
                  <textarea
                    value={editingStepInstruction}
                    onChange={e => setEditingStepInstruction(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button onClick={() => setEditingStepId(null)}
                      style={{ padding: "5px 12px", background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#475569" }}>
                      Cancel
                    </button>
                    <button onClick={() => onSaveStepEdit(step.id)}
                      style={{ padding: "5px 14px", background: "#6366f1", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (!isAdmin) return;
                    setEditingStepId(step.id);
                    setEditingStepTitle(step.title || "");
                    setEditingStepInstruction(step.instruction || "");
                  }}
                  title={isAdmin ? "Click to edit" : ""}
                  style={{
                    fontSize: 13, color: "#374151", lineHeight: "1.6",
                    whiteSpace: "pre-line", marginTop: 4,
                    cursor: isAdmin ? "text" : "default",
                    padding: "4px 6px", borderRadius: 5,
                    border: "1px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => { if (isAdmin) e.currentTarget.style.borderColor = "#e0e7ff"; }}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
                >
                  {step.instruction}
                </div>
              )}

              {/* Timer controls */}
              {isAdmin && !showTimer && !hasTimer && !isEditingStep && (
                <button onClick={() => setShowTimer(true)} className="mt-2 text-xs text-muted-foreground border border-dashed border-border rounded px-2 py-1 hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Add Timer
                </button>
              )}
              {isAdmin && !showTimer && hasTimer && !isEditingStep && (
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => setShowTimer(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => onTimerRemove(step.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              )}
              {isAdmin && showTimer && (
                <TimerEditor step={step} onSave={handleTimerSave} onCancel={() => setShowTimer(false)} saving={timerSaving} />
              )}

              {/* Measurement parameters */}
              {step.measurement_parameters && step.measurement_parameters.length > 0 && !isEditingMeasurements && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {step.measurement_parameters.map((param, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                      📏 {param.name}{param.unit ? ` (${param.unit})` : ""}{param.min_value != null || param.max_value != null ? `: ${param.min_value ?? ""}–${param.max_value ?? ""}` : ""}{param.required && " *"}
                    </span>
                  ))}
                  {isAdmin && (
                    <button onClick={() => setEditingMeasurementsStepId(step.id)} style={{ fontSize: 10, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                  )}
                </div>
              )}
              {isAdmin && (!step.measurement_parameters || step.measurement_parameters.length === 0) && !isEditingMeasurements && !isEditingStep && (
                <button onClick={() => setEditingMeasurementsStepId(step.id)} style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", background: "none", border: "1px dashed #e2e8f0", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                  📏 Add Measurement
                </button>
              )}
              {isEditingMeasurements && (
                <MeasurementEditor step={step} onSave={onMeasurementSave} onCancel={() => setEditingMeasurementsStepId(null)} />
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── ChecklistItemRow ─────────────────────────────────────────────────────────
function ChecklistItemRow({ item }) {
  const icons = { reagent: Beaker, equipment: Wrench, safety: Shield, other: Tag };
  const styles = { reagent: "text-violet-600", equipment: "text-blue-600", safety: "text-red-600", other: "text-gray-500" };
  const Icon = icons[item.category] || Tag;
  return (
    <div className="flex items-start gap-2 py-2">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${styles[item.category]}`} />
      <span className="text-sm text-foreground">{item.item_text}</span>
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────
const SECTION_BORDER = {
  purpose: "border-l-4 border-l-indigo-400",
  materials: "border-l-4 border-l-emerald-400",
  controls: "border-l-4 border-l-blue-400",
  risk: "border-l-4 border-l-red-400",
  data_analysis: "border-l-4 border-l-amber-400",
  general: "border-l-4 border-l-gray-300",
};

function SectionCard({ section }) {
  const borderClass = SECTION_BORDER[section.type] || SECTION_BORDER.general;
  if (section.type === "materials" && section.subsections?.length > 0) {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 ${borderClass}`}>
        <h3 className="font-semibold text-sm text-foreground mb-3">{section.title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {section.subsections.map(sub => (
            <div key={sub.id}>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{sub.title}</p>
              <ul className="space-y-1">
                {(sub.items || []).map((item, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />{item}
                  </li>
                ))}
                {(sub.items || []).length === 0 && <li className="text-xs text-muted-foreground italic">None listed</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${borderClass}`}>
      <h3 className="font-semibold text-sm text-foreground mb-2">{section.title}</h3>
      <ul className="space-y-1">
        {(section.items || []).map((item, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed">{item}</li>
        ))}
        {(section.items || []).length === 0 && <li className="text-xs text-muted-foreground italic">No content</li>}
      </ul>
    </div>
  );
}

// ─── PreRunModal ──────────────────────────────────────────────────────────────
function PreRunModal({ protocol, steps, checklistItems, onStart, onCancel }) {
  const [tab, setTab] = useState("checklist");
  const [checkState, setCheckState] = useState(() => {
    const init = {};
    checklistItems.forEach(item => { init[item.id] = { verified: false, lot_number: "", expiry_date: "" }; });
    return init;
  });
  const [operatorName, setOperatorName] = useState("");
  const [sampleRef, setSampleRef] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [temperature, setTemperature] = useState("");
  const [tempUnit, setTempUnit] = useState("celsius");
  const [humidity, setHumidity] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setOperatorName(u.full_name || u.email || ""));
  }, []);

  function getExpiryWarning(expiryDateStr) {
    if (!expiryDateStr) return null;
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return { type: "expired", message: `Expired ${Math.abs(daysUntilExpiry)} days ago`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
    if (daysUntilExpiry <= 7) return { type: "critical", message: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
    if (daysUntilExpiry <= 30) return { type: "warning", message: `Expires in ${daysUntilExpiry} days`, color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
    return null;
  }

  const safetyItems = checklistItems.filter(i => i.category === "safety");
  const allSafetyVerified = safetyItems.every(i => checkState[i.id]?.verified);
  const hasExpiredItems = Object.entries(checkState).some(([, state]) => {
    if (!state.expiry_date) return false;
    return new Date(state.expiry_date) < new Date();
  });
  const canStart = allSafetyVerified && !hasExpiredItems;
  const totalVerified = checklistItems.filter(i => checkState[i.id]?.verified).length;

  function markAll() {
    const updated = {};
    checklistItems.forEach(item => { updated[item.id] = { ...(checkState[item.id] || {}), verified: true }; });
    setCheckState(updated);
  }

  async function handleStart() {
    setStarting(true);
    await onStart(protocol, checkState, {
      operator_name: operatorName,
      sample_reference: sampleRef,
      instrument_id: instrumentId,
      temperature: temperature ? parseFloat(temperature) : null,
      temperature_unit: tempUnit,
      humidity: humidity ? parseFloat(humidity) : null,
      context_notes: contextNotes,
    });
    setStarting(false);
  }

  const catOrder = ["safety", "equipment", "reagent", "other"];
  const catLabels = { safety: "Safety", equipment: "Equipment", reagent: "Reagents", other: "Other" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 14, maxWidth: 600, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 4 }}>PRE-RUN SETUP</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>{protocol.name}</h2>
            </div>
            <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", padding: "0 4px" }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {["checklist", "details"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent", color: tab === t ? "#6366f1" : "#94a3b8" }}>
                {t === "checklist" ? "Checklist" : "Run Details"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {tab === "checklist" && (
            <div>
              {checklistItems.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "24px 0" }}>No checklist items for this protocol.</p>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button onClick={markAll} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "1px solid #e0e7ff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>Mark all verified</button>
                  </div>
                  {catOrder.map(cat => {
                    const items = checklistItems.filter(i => i.category === cat);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>{catLabels[cat]}</div>
                        {items.map(item => (
                          <div key={item.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: checkState[item.id]?.verified ? 8 : 0 }}>
                              <input type="checkbox" checked={checkState[item.id]?.verified || false}
                                onChange={e => setCheckState(p => ({ ...p, [item.id]: { ...p[item.id], verified: e.target.checked } }))}
                                style={{ width: 16, height: 16, cursor: "pointer" }} />
                              <span style={{ fontSize: 14, color: "#1e293b", flex: 1 }}>{item.item_text}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                                background: cat === "safety" ? "#fef2f2" : cat === "equipment" ? "#eff6ff" : cat === "reagent" ? "#f5f3ff" : "#f1f5f9",
                                color: cat === "safety" ? "#dc2626" : cat === "equipment" ? "#1d4ed8" : cat === "reagent" ? "#7c3aed" : "#64748b",
                              }}>{cat}</span>
                            </div>
                            {checkState[item.id]?.verified && (
                              <div>
                                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 3 }}>LOT #</label>
                                    <input type="text" value={checkState[item.id]?.lot_number || ""}
                                      onChange={e => setCheckState(p => ({ ...p, [item.id]: { ...p[item.id], lot_number: e.target.value } }))}
                                      placeholder="Lot number"
                                      style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 3 }}>EXPIRY</label>
                                    <input type="date" value={checkState[item.id]?.expiry_date || ""}
                                      onChange={e => setCheckState(p => ({ ...p, [item.id]: { ...p[item.id], expiry_date: e.target.value } }))}
                                      style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }} />
                                  </div>
                                </div>
                                {(() => {
                                  const warning = getExpiryWarning(checkState[item.id]?.expiry_date);
                                  if (!warning) return null;
                                  return (
                                    <div style={{ marginTop: 4, padding: "4px 10px", borderRadius: 5, background: warning.bg, border: `1px solid ${warning.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 12 }}>{warning.type === "expired" ? "🚫" : "⚠️"}</span>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: warning.color }}>
                                        {warning.message}
                                        {warning.type === "expired" && " — do not use this reagent"}
                                        {warning.type === "critical" && " — verify before use"}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>OPERATOR NAME</label>
                <input value={operatorName} onChange={e => setOperatorName(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>SAMPLE REFERENCE</label>
                <input value={sampleRef} onChange={e => setSampleRef(e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>INSTRUMENT ID</label>
                <input value={instrumentId} onChange={e => setInstrumentId(e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>TEMPERATURE</label>
                  <input type="number" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>UNIT</label>
                  <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                    <button onClick={() => setTempUnit("celsius")} style={{ padding: "7px 12px", border: `1px solid ${tempUnit === "celsius" ? "#6366f1" : "#e2e8f0"}`, borderRadius: 7, background: tempUnit === "celsius" ? "#eef2ff" : "white", color: tempUnit === "celsius" ? "#6366f1" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>°C</button>
                    <button onClick={() => setTempUnit("fahrenheit")} style={{ padding: "7px 12px", border: `1px solid ${tempUnit === "fahrenheit" ? "#6366f1" : "#e2e8f0"}`, borderRadius: 7, background: tempUnit === "fahrenheit" ? "#eef2ff" : "white", color: tempUnit === "fahrenheit" ? "#6366f1" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>°F</button>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>HUMIDITY %</label>
                <input type="number" min={0} max={100} value={humidity} onChange={e => setHumidity(e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>CONTEXT NOTES</label>
                <textarea value={contextNotes} onChange={e => setContextNotes(e.target.value)} rows={3} placeholder="Any additional context..." style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{totalVerified} of {checklistItems.length} items verified</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ padding: "9px 18px", background: "white", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#64748b" }}>Cancel</button>
            <button onClick={handleStart} disabled={starting || !canStart}
              style={{ padding: "9px 20px", background: starting || !canStart ? "#94a3b8" : "#6366f1", border: "none", borderRadius: 8, color: "white", cursor: starting || !canStart ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700 }}>
              {starting ? "Starting..." : hasExpiredItems ? "🚫 Expired items — cannot start" : !allSafetyVerified ? "Verify safety items first" : "Start Run →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  draft: "bg-gray-100 text-gray-600 border border-gray-200",
  archived: "bg-slate-100 text-slate-500 border border-slate-200",
};
const CLASS_STYLES = {
  "Academic Research": "bg-violet-50 text-violet-700",
  "Clinical Diagnostic": "bg-cyan-50 text-cyan-700",
  "GMP Manufacturing": "bg-orange-50 text-orange-700",
  "ISO Accredited": "bg-blue-50 text-blue-700",
  "CRO Study": "bg-teal-50 text-teal-700",
  "Biotech Startup": "bg-fuchsia-50 text-fuchsia-700",
  "General": "bg-gray-100 text-gray-600",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProtocolDetail() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const orgId = localStorage.getItem("bt_org_id");
  const role = localStorage.getItem("bt_role");
  const isAdmin = role === "admin";

  const urlParams = new URLSearchParams(window.location.search);
  const protocolId = urlParams.get("id");

  const [protocol, setProtocol] = useState(null);
  const [steps, setSteps] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showPreRunModal, setShowPreRunModal] = useState(false);

  const [editingMeasurementsStepId, setEditingMeasurementsStepId] = useState(null);
  const [editingStepId, setEditingStepId] = useState(null);
  const [editingStepTitle, setEditingStepTitle] = useState("");
  const [editingStepInstruction, setEditingStepInstruction] = useState("");

  // Checklist add form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("other");
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    async function load() {
      if (!protocolId) { navigate("/protocols"); return; }
      const [protos, stepsData, checkData] = await Promise.all([
        base44.entities.Protocol.filter({ organization_id: orgId, id: protocolId }),
        base44.entities.ProtocolStep.filter({ organization_id: orgId, protocol_id: protocolId }, "step_order"),
        base44.entities.ProtocolChecklistItem.filter({ organization_id: orgId, protocol_id: protocolId }, "item_order"),
      ]);
      if (!protos || protos.length === 0) { navigate("/protocols"); return; }
      setProtocol(protos[0]);
      setSteps(stepsData);
      setChecklistItems(checkData);
      setLoading(false);
    }
    load();
  }, [protocolId, orgId]);

  async function handleDragEnd(result) {
    if (!result.destination) return;
    const reordered = Array.from(steps);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, step_order: i + 1 }));
    setSteps(updated);
    await Promise.all(updated.map(s => base44.entities.ProtocolStep.update(s.id, { step_order: s.step_order })));
  }

  async function handleTimerSave(stepId, timingMode, durationSeconds, toleranceLower, toleranceUpper) {
    await base44.entities.ProtocolStep.update(stepId, { timing_mode: timingMode, expected_duration_seconds: durationSeconds || null, tolerance_lower_seconds: toleranceLower || 0, tolerance_upper_seconds: toleranceUpper || 0 });
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, timing_mode: timingMode, expected_duration_seconds: durationSeconds || null, tolerance_lower_seconds: toleranceLower || 0, tolerance_upper_seconds: toleranceUpper || 0 } : s));
  }

  async function handleTimerRemove(stepId) {
    await base44.entities.ProtocolStep.update(stepId, { timing_mode: "none", expected_duration_seconds: null, tolerance_lower_seconds: 0, tolerance_upper_seconds: 0 });
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, timing_mode: "none", expected_duration_seconds: null, tolerance_lower_seconds: 0, tolerance_upper_seconds: 0 } : s));
  }

  async function handleMeasurementSave(stepId, parameters) {
    await base44.entities.ProtocolStep.update(stepId, { measurement_parameters: parameters });
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, measurement_parameters: parameters } : s));
    setEditingMeasurementsStepId(null);
  }

  async function handleSaveStepEdit(stepId) {
    await base44.entities.ProtocolStep.update(stepId, { title: editingStepTitle.trim() || null, instruction: editingStepInstruction.trim() });
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, title: editingStepTitle.trim() || null, instruction: editingStepInstruction.trim() } : s));
    setEditingStepId(null);
  }

  async function handleDeleteStep(stepId) {
    if (!window.confirm("Delete this step? This cannot be undone.")) return;
    await base44.entities.ProtocolStep.delete(stepId);
    const remaining = steps.filter(s => s.id !== stepId).sort((a, b) => a.step_order - b.step_order);
    await Promise.all(remaining.map((s, i) => base44.entities.ProtocolStep.update(s.id, { step_order: i + 1 })));
    setSteps(remaining.map((s, i) => ({ ...s, step_order: i + 1 })));
  }

  async function handleAddStep(afterStepOrder = null) {
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
    const insertAt = afterStepOrder !== null ? afterStepOrder + 1 : sortedSteps.length + 1;
    const stepsToShift = sortedSteps.filter(s => s.step_order >= insertAt);
    await Promise.all(stepsToShift.map(s => base44.entities.ProtocolStep.update(s.id, { step_order: s.step_order + 1 })));
    const newStep = await base44.entities.ProtocolStep.create({
      organization_id: orgId,
      protocol_id: protocolId,
      step_order: insertAt,
      instruction: "New step — click to edit",
      title: "",
      is_critical: false,
      timing_mode: "none",
    });
    setSteps(prev => [
      ...prev.map(s => s.step_order >= insertAt ? { ...s, step_order: s.step_order + 1 } : s),
      { ...newStep },
    ].sort((a, b) => a.step_order - b.step_order));
    setEditingStepId(newStep.id);
    setEditingStepTitle("");
    setEditingStepInstruction("New step — click to edit");
  }

  async function handleDuplicateStep(step) {
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
    const insertAt = step.step_order + 1;
    const stepsToShift = sortedSteps.filter(s => s.step_order >= insertAt);
    await Promise.all(stepsToShift.map(s => base44.entities.ProtocolStep.update(s.id, { step_order: s.step_order + 1 })));
    const duplicate = await base44.entities.ProtocolStep.create({
      organization_id: orgId,
      protocol_id: protocolId,
      step_order: insertAt,
      title: step.title || "",
      instruction: step.instruction,
      is_critical: step.is_critical || false,
      timing_mode: step.timing_mode || "none",
      expected_duration_seconds: step.expected_duration_seconds || null,
      tolerance_lower_seconds: step.tolerance_lower_seconds || 0,
      tolerance_upper_seconds: step.tolerance_upper_seconds || 0,
      requires_measurement: step.requires_measurement || false,
      measurement_parameters: step.measurement_parameters || [],
    });
    setSteps(prev => [
      ...prev.map(s => s.step_order >= insertAt ? { ...s, step_order: s.step_order + 1 } : s),
      { ...duplicate },
    ].sort((a, b) => a.step_order - b.step_order));
  }

  async function handleToggleCritical(step) {
    const newValue = !step.is_critical;
    await base44.entities.ProtocolStep.update(step.id, { is_critical: newValue });
    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, is_critical: newValue } : s));
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return;
    setAddingItem(true);
    const newItem = await base44.entities.ProtocolChecklistItem.create({
      organization_id: orgId,
      protocol_id: protocolId,
      item_order: checklistItems.length + 1,
      item_text: newItemText.trim(),
      category: newItemCategory,
    });
    setChecklistItems(prev => [...prev, newItem]);
    setNewItemText(""); setNewItemCategory("other"); setShowAddItem(false);
    setAddingItem(false);
  }

  async function handleStartRun(proto, checklistData, runDetails) {
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    const stepsData = await base44.entities.ProtocolStep.filter({ protocol_id: proto.id, organization_id: orgId }, "step_order");
    const sortedSteps = stepsData.sort((a, b) => a.step_order - b.step_order);
    const run = await base44.entities.Run.create({
      organization_id: orgId,
      protocol_id: proto.id,
      steps_snapshot: { steps: sortedSteps.map(s => ({ id: s.id, step_order: s.step_order, title: s.title, instruction: s.instruction, is_critical: s.is_critical, timing_mode: s.timing_mode, expected_duration_seconds: s.expected_duration_seconds, tolerance_lower_seconds: s.tolerance_lower_seconds, tolerance_upper_seconds: s.tolerance_upper_seconds, measurement_parameters: s.measurement_parameters || [] })) },
      operator_user_id: user.id,
      operator_name: runDetails.operator_name || user.full_name || user.email,
      run_state: "in_progress",
      run_started_at: now,
      checklist_completed: checklistData,
      sample_reference: runDetails.sample_reference || null,
      instrument_id: runDetails.instrument_id || null,
      temperature: runDetails.temperature || null,
      temperature_unit: runDetails.temperature_unit || "celsius",
      humidity: runDetails.humidity || null,
      context_notes: runDetails.context_notes || null,
    });
    await Promise.all(sortedSteps.map(step => base44.entities.StepRun.create({
      organization_id: orgId, run_id: run.id, step_id: step.id, step_order: step.step_order, step_state: "pending",
    })));
    await base44.entities.AuditLog.create({
      organization_id: orgId, entity_type: "Run", entity_id: run.id, event_type: "run_started",
      actor_user_id: user.id, actor_email: user.email,
      metadata: { protocol_id: proto.id, step_count: sortedSteps.length }, created_at: now,
    });
    navigate(`/run-execution?id=${run.id}`);
  }

  async function handlePublish() {
    setPublishing(true);
    const user = await base44.auth.me();
    const newVer = (protocol.version || 1) + 1;
    await base44.entities.ProtocolVersion.create({
      organization_id: orgId, protocol_id: protocol.id, version_number: protocol.version || 1,
      snapshot_json: { name: protocol.name, steps: steps.map(s => ({ id: s.id, step_order: s.step_order, title: s.title, instruction: s.instruction, is_critical: s.is_critical, timing_mode: s.timing_mode, expected_duration_seconds: s.expected_duration_seconds, tolerance_lower_seconds: s.tolerance_lower_seconds, tolerance_upper_seconds: s.tolerance_upper_seconds, requires_measurement: s.requires_measurement, measurement_parameters: s.measurement_parameters })), checklist: checklistItems, sections: protocol.sections_json || [], metadata: { classification: protocol.classification, compliance_tags: protocol.compliance_tags, estimated_duration_minutes: protocol.estimated_duration_minutes } },
      change_summary: `Version ${protocol.version || 1} published`, created_by_id: user.id,
    });
    await base44.entities.Protocol.update(protocol.id, { status: "active", version: newVer });
    const now = new Date().toISOString();
    await base44.entities.AuditLog.create({
      organization_id: orgId, entity_type: "Protocol", entity_id: protocol.id, event_type: "protocol_published",
      actor_user_id: user.id, actor_email: user.email, metadata: { version_number: protocol.version || 1 }, created_at: now,
    });
    setProtocol(p => ({ ...p, status: "active", version: newVer }));
    setPublishing(false);
    toast({ title: "Protocol published", description: `Now active at version ${newVer}.` });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const catOrder = ["safety", "equipment", "reagent", "other"];
  const grouped = catOrder.reduce((acc, cat) => {
    const items = checklistItems.filter(i => i.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/protocols")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Protocols
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <h1 className="text-xl font-bold text-foreground leading-tight mb-3">{protocol.name}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[protocol.status]}`}>{protocol.status}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium ${CLASS_STYLES[protocol.classification] || CLASS_STYLES.General}`}>{protocol.classification}</span>
              {(protocol.compliance_tags || []).map(tag => (
                <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{tag}</span>
              ))}
            </div>
            {protocol.description && <p className="text-sm text-muted-foreground leading-relaxed">{protocol.description}</p>}
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {["overview", "steps", "checklist"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {tab === "overview" ? "Overview" : tab === "steps" ? `Steps (${steps.length})` : `Checklist (${checklistItems.length})`}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-3">
              {(protocol.sections_json || []).length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">No overview sections. Import an SOP to populate this area.</p>
                </div>
              ) : (
                (protocol.sections_json || []).sort((a, b) => a.order - b.order).map(sec => <SectionCard key={sec.id} section={sec} />)
              )}
            </div>
          )}

          {activeTab === "steps" && (
            <>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {sortedSteps.length === 0 ? (
                        <div className="bg-card border border-border rounded-lg p-8 text-center">
                          <p className="text-sm text-muted-foreground">No steps yet.</p>
                        </div>
                      ) : (
                        sortedSteps.map((step, index) => (
                          <div key={step.id}>
                            <StepCard
                              step={step}
                              index={index}
                              isAdmin={isAdmin}
                              onTimerSave={handleTimerSave}
                              onTimerRemove={handleTimerRemove}
                              editingMeasurementsStepId={editingMeasurementsStepId}
                              setEditingMeasurementsStepId={setEditingMeasurementsStepId}
                              onMeasurementSave={handleMeasurementSave}
                              onDelete={handleDeleteStep}
                              onDuplicate={handleDuplicateStep}
                              onToggleCritical={handleToggleCritical}
                              editingStepId={editingStepId}
                              setEditingStepId={setEditingStepId}
                              editingStepTitle={editingStepTitle}
                              setEditingStepTitle={setEditingStepTitle}
                              editingStepInstruction={editingStepInstruction}
                              setEditingStepInstruction={setEditingStepInstruction}
                              onSaveStepEdit={handleSaveStepEdit}
                            />
                            {/* Insert button between steps */}
                            {index < sortedSteps.length - 1 && isAdmin && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
                                <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                                <button
                                  onClick={() => handleAddStep(step.step_order)}
                                  title="Insert step here"
                                  style={{ fontSize: 11, color: "#94a3b8", background: "white", border: "1px solid #e2e8f0", borderRadius: 99, padding: "1px 10px", cursor: "pointer", transition: "all 0.15s" }}
                                  onMouseEnter={e => { e.target.style.color = "#6366f1"; e.target.style.borderColor = "#6366f1"; }}
                                  onMouseLeave={e => { e.target.style.color = "#94a3b8"; e.target.style.borderColor = "#e2e8f0"; }}>
                                  + insert
                                </button>
                                <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {isAdmin && (
                <div className="mt-3">
                  <button onClick={() => handleAddStep()}
                    className="w-full text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add Step
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === "checklist" && (
            <div className="space-y-4">
              {Object.keys(grouped).length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">No checklist items yet.</p>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 capitalize">{cat}</h3>
                    <div className="divide-y divide-border">
                      {items.map(item => <ChecklistItemRow key={item.id} item={item} />)}
                    </div>
                  </div>
                ))
              )}
              {isAdmin && (
                <div className="mt-2">
                  {!showAddItem ? (
                    <button onClick={() => setShowAddItem(true)} className="w-full text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  ) : (
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">New Checklist Item</p>
                      <Input placeholder="Item text" value={newItemText} onChange={e => setNewItemText(e.target.value)} />
                      <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card text-foreground">
                        <option value="safety">Safety</option>
                        <option value="equipment">Equipment</option>
                        <option value="reagent">Reagent</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddItem} disabled={addingItem || !newItemText.trim()}>{addingItem ? "Adding..." : "Add Item"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Protocol Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">v{protocol.version || 1}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Steps</span><span className="font-medium">{steps.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Checklist</span><span className="font-medium">{checklistItems.length} items</span></div>
              {protocol.estimated_duration_minutes && (
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Duration</span><span className="font-medium">{protocol.estimated_duration_minutes}m</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium text-xs">{new Date(protocol.created_date).toLocaleDateString()}</span></div>
            </div>
          </div>
          <Button className="w-full" onClick={() => setShowPreRunModal(true)}>
            <Play className="w-4 h-4 mr-2" /> Start Run
          </Button>
          {isAdmin && protocol.status !== "active" && (
            <Button variant="outline" className="w-full" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing..." : "Publish Version"}
            </Button>
          )}
        </div>
      </div>

      {showPreRunModal && (
        <PreRunModal
          protocol={protocol}
          steps={steps}
          checklistItems={checklistItems}
          onStart={handleStartRun}
          onCancel={() => setShowPreRunModal(false)}
        />
      )}
    </div>
  );
}