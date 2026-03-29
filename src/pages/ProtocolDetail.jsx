import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ArrowLeft, Clock, AlertTriangle, GripVertical, Plus, Play, Tag,
  Shield, Beaker, Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtDuration(sec) {
  if (!sec) return "";
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m > 0 ? m + "m" : ""}`.trim();
  if (s > 0) return `${m}m ${s}s`;
  return `${m}m`;
}

function secToHMS(sec) {
  if (!sec) return { h: 0, m: 0, s: 0 };
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

function hmsToSec(h, m, s) {
  return (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
}

// ─── MeasurementEditor — module top level ─────────────────────────────────────
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

  const inputStyle = {
    width: "100%", padding: "5px 7px", border: "1px solid #e2e8f0",
    borderRadius: 6, fontSize: 12, boxSizing: "border-box", background: "white",
  };

  return (
    <div style={{ marginTop: 10, padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 10 }}>📏 MEASUREMENT PARAMETERS</div>

      {params.map((param, idx) => (
        <div key={idx} style={{ background: "white", borderRadius: 7, padding: 10, marginBottom: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>PARAMETER NAME *</label>
              <input value={param.name} placeholder="e.g. A260/A280 ratio"
                onChange={e => updateParam(idx, "name", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>UNIT</label>
              <input value={param.unit} placeholder="e.g. ng/µL"
                onChange={e => updateParam(idx, "unit", e.target.value)} style={inputStyle} />
            </div>
            <button onClick={() => removeParam(idx)}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, paddingTop: 18, flexShrink: 0 }}>
              ×
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>MIN VALUE</label>
              <input type="number" value={param.min_value ?? ""} placeholder="—"
                onChange={e => updateParam(idx, "min_value", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>MAX VALUE</label>
              <input type="number" value={param.max_value ?? ""} placeholder="—"
                onChange={e => updateParam(idx, "max_value", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 14 }}>
              <input type="checkbox" id={`req_${idx}`} checked={param.required !== false}
                onChange={e => updateParam(idx, "required", e.target.checked)} />
              <label htmlFor={`req_${idx}`} style={{ fontSize: 11, color: "#475569", cursor: "pointer" }}>Required</label>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addParam}
        style={{ width: "100%", padding: "7px", background: "white", border: "1px dashed #bbf7d0", borderRadius: 7, fontSize: 12, color: "#16a34a", fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
        + Add Parameter
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} disabled={saving}
          style={{ flex: 1, padding: "7px", background: "white", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, cursor: "pointer", color: "#475569" }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || params.every(p => !p.name.trim())}
          style={{ flex: 2, padding: "7px", background: "#16a34a", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "✓ Save Parameters"}
        </button>
      </div>
    </div>
  );
}

// ─── TimerEditor — module top level, BEFORE page component ───────────────────
function TimerEditor({ step, onSave, onCancel, saving }) {
  const initial = secToHMS(step.expected_duration_seconds);
  const [h, setH] = useState(initial.h);
  const [m, setM] = useState(initial.m);
  const [s, setS] = useState(initial.s);
  const [mode, setMode] = useState(step.timing_mode !== "none" ? step.timing_mode : "advisory");
  const [tolLower, setTolLower] = useState(
    step.tolerance_lower_seconds ? Math.floor(step.tolerance_lower_seconds / 60) : 0
  );
  const [tolUpper, setTolUpper] = useState(
    step.tolerance_upper_seconds ? Math.floor(step.tolerance_upper_seconds / 60) : 0
  );

  const totalSeconds = hmsToSec(h, m, s);

  function setQuick(sec) {
    const v = secToHMS(sec);
    setH(v.h); setM(v.m); setS(v.s);
  }

  const QUICK = [
    { label: "30s", sec: 30 }, { label: "1m", sec: 60 }, { label: "2m", sec: 120 },
    { label: "5m", sec: 300 }, { label: "10m", sec: 600 }, { label: "30m", sec: 1800 },
    { label: "1h", sec: 3600 },
  ];

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={99} value={h} onChange={e => setH(e.target.value)}
            className="w-14 text-center border border-input rounded px-2 py-1 text-sm bg-card" placeholder="HH" />
          <span className="text-muted-foreground text-xs">h</span>
        </div>
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={59} value={m} onChange={e => setM(e.target.value)}
            className="w-14 text-center border border-input rounded px-2 py-1 text-sm bg-card" placeholder="MM" />
          <span className="text-muted-foreground text-xs">m</span>
        </div>
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={59} value={s} onChange={e => setS(e.target.value)}
            className="w-14 text-center border border-input rounded px-2 py-1 text-sm bg-card" placeholder="SS" />
          <span className="text-muted-foreground text-xs">s</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {QUICK.map(q => (
          <button key={q.label} onClick={() => setQuick(q.sec)}
            className="text-xs px-2 py-1 rounded bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mode:</span>
        <button onClick={() => setMode("advisory")}
          className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${mode === "advisory" ? "bg-blue-100 text-blue-700" : "bg-card border border-border text-muted-foreground"}`}>
          Advisory
        </button>
        <button onClick={() => setMode("strict")}
          className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${mode === "strict" ? "bg-red-100 text-red-700" : "bg-card border border-border text-muted-foreground"}`}>
          Strict
        </button>
      </div>

      {mode === "strict" && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 }}>TOLERANCE WINDOW</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
            Acceptable deviation from target before flagging as deviation
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>EARLY BY (min)</label>
              <input type="number" min="0" max="60" value={tolLower}
                onChange={e => setTolLower(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, textAlign: "center", fontWeight: 600, boxSizing: "border-box" }} />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", paddingTop: 16 }}>←→</div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>LATE BY (min)</label>
              <input type="number" min="0" max="60" value={tolUpper}
                onChange={e => setTolUpper(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, textAlign: "center", fontWeight: 600, boxSizing: "border-box" }} />
            </div>
          </div>
          {totalSeconds > 0 && (tolLower > 0 || tolUpper > 0) && (
            <div style={{ marginTop: 8, padding: "5px 10px", background: "#fef2f2", borderRadius: 6, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
              Acceptable window: {(() => {
                const lower = totalSeconds - tolLower * 60;
                const upper = totalSeconds + tolUpper * 60;
                const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
                return `${fmt(Math.max(0, lower))} → ${fmt(upper)}`;
              })()}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" disabled={saving || totalSeconds <= 0}
          onClick={() => totalSeconds > 0 && onSave(step.id, mode, totalSeconds, tolLower * 60, tolUpper * 60)}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── StepCard ────────────────────────────────────────────────────────────────
function StepCard({ step, index, isAdmin, onTimerSave, onTimerRemove, editingMeasurementsStepId, setEditingMeasurementsStepId, onMeasurementSave }) {
  const [showTimer, setShowTimer] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const hasTimer = step.timing_mode && step.timing_mode !== "none" && step.expected_duration_seconds;

  async function handleTimerSave(stepId, timingMode, durationSeconds, toleranceLower, toleranceUpper) {
    setTimerSaving(true);
    await onTimerSave(stepId, timingMode, durationSeconds, toleranceLower, toleranceUpper);
    setTimerSaving(false);
    setShowTimer(false);
  }

  async function handleTimerRemove() {
    await onTimerRemove(step.id);
  }

  const isEditingMeasurements = editingMeasurementsStepId === step.id;

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
              <div className="flex items-start gap-2 mb-2">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {step.step_order}
                </span>
                {step.title && (
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide mt-0.5">
                    {step.title}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
                  {step.is_critical && (
                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Critical
                    </span>
                  )}
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
                      {step.timing_mode === "strict" && (step.tolerance_lower_seconds > 0 || step.tolerance_upper_seconds > 0) && (
                        <span style={{ opacity: 0.7 }}>
                          {" "}±{Math.max(step.tolerance_lower_seconds || 0, step.tolerance_upper_seconds || 0) / 60}m
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{step.instruction}</p>

              {/* Timer controls */}
              {isAdmin && !showTimer && !hasTimer && (
                <button onClick={() => setShowTimer(true)}
                  className="mt-2 text-xs text-muted-foreground border border-dashed border-border rounded px-2 py-1 hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Add Timer
                </button>
              )}
              {isAdmin && !showTimer && hasTimer && (
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => setShowTimer(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={handleTimerRemove} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              )}
              {isAdmin && showTimer && (
                <TimerEditor
                  step={step}
                  onSave={handleTimerSave}
                  onCancel={() => setShowTimer(false)}
                  saving={timerSaving}
                />
              )}

              {/* Measurement parameters display */}
              {step.measurement_parameters && step.measurement_parameters.length > 0 && !isEditingMeasurements && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {step.measurement_parameters.map((param, i) => (
                    <span key={i} style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                      background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
                    }}>
                      📏 {param.name}{param.unit ? ` (${param.unit})` : ""}{param.min_value != null || param.max_value != null ? `: ${param.min_value ?? ""}–${param.max_value ?? ""}` : ""}
                      {param.required && " *"}
                    </span>
                  ))}
                  {isAdmin && (
                    <button onClick={() => setEditingMeasurementsStepId(step.id)}
                      style={{ fontSize: 10, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
                      Edit
                    </button>
                  )}
                </div>
              )}

              {/* Add measurement button */}
              {isAdmin && (!step.measurement_parameters || step.measurement_parameters.length === 0) && !isEditingMeasurements && (
                <button onClick={() => setEditingMeasurementsStepId(step.id)}
                  style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", background: "none", border: "1px dashed #e2e8f0", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                  📏 Add Measurement
                </button>
              )}

              {/* Measurement editor */}
              {isEditingMeasurements && (
                <MeasurementEditor
                  step={step}
                  onSave={onMeasurementSave}
                  onCancel={() => setEditingMeasurementsStepId(null)}
                />
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
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                    {item}
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
  const [editingMeasurementsStepId, setEditingMeasurementsStepId] = useState(null);

  // Add step form
  const [showAddStep, setShowAddStep] = useState(false);
  const [newInstruction, setNewInstruction] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCritical, setNewCritical] = useState(false);
  const [addingStep, setAddingStep] = useState(false);

  // Add checklist item form
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
    await base44.entities.ProtocolStep.update(stepId, {
      timing_mode: timingMode,
      expected_duration_seconds: durationSeconds || null,
      tolerance_lower_seconds: toleranceLower || 0,
      tolerance_upper_seconds: toleranceUpper || 0,
    });
    setSteps(prev => prev.map(s => s.id === stepId
      ? { ...s, timing_mode: timingMode, expected_duration_seconds: durationSeconds || null, tolerance_lower_seconds: toleranceLower || 0, tolerance_upper_seconds: toleranceUpper || 0 }
      : s
    ));
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

  async function handleAddStep() {
    if (!newInstruction.trim()) return;
    setAddingStep(true);
    const newStep = await base44.entities.ProtocolStep.create({
      organization_id: orgId,
      protocol_id: protocolId,
      step_order: steps.length + 1,
      title: newTitle.trim() || "",
      instruction: newInstruction.trim(),
      is_critical: newCritical,
      timing_mode: "none",
    });
    setSteps(prev => [...prev, newStep]);
    setNewInstruction(""); setNewTitle(""); setNewCritical(false); setShowAddStep(false);
    setAddingStep(false);
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

  async function handlePublish() {
    setPublishing(true);
    const user = await base44.auth.me();
    const newVer = (protocol.version || 1) + 1;

    await base44.entities.ProtocolVersion.create({
      organization_id: orgId,
      protocol_id: protocol.id,
      version_number: protocol.version || 1,
      snapshot_json: {
        name: protocol.name,
        steps: steps.map(s => ({
          id: s.id, step_order: s.step_order, title: s.title, instruction: s.instruction,
          is_critical: s.is_critical, timing_mode: s.timing_mode,
          expected_duration_seconds: s.expected_duration_seconds,
          tolerance_lower_seconds: s.tolerance_lower_seconds,
          tolerance_upper_seconds: s.tolerance_upper_seconds,
          requires_measurement: s.requires_measurement,
          measurement_parameters: s.measurement_parameters,
        })),
        checklist: checklistItems,
        sections: protocol.sections_json || [],
        metadata: { classification: protocol.classification, compliance_tags: protocol.compliance_tags, estimated_duration_minutes: protocol.estimated_duration_minutes },
      },
      change_summary: `Version ${protocol.version || 1} published`,
      created_by_id: user.id,
    });

    await base44.entities.Protocol.update(protocol.id, { status: "active", version: newVer });

    await base44.entities.AuditLog.create({
      organization_id: orgId,
      entity_type: "Protocol",
      entity_id: protocol.id,
      event_type: "protocol_published",
      actor_user_id: user.id,
      actor_email: user.email,
      metadata: { version_number: protocol.version || 1 },
      created_at: new Date().toISOString(),
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

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/protocols")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Protocols
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <h1 className="text-xl font-bold text-foreground leading-tight mb-3">{protocol.name}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[protocol.status]}`}>
                {protocol.status}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium ${CLASS_STYLES[protocol.classification] || CLASS_STYLES.General}`}>
                {protocol.classification}
              </span>
              {(protocol.compliance_tags || []).map(tag => (
                <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{tag}</span>
              ))}
            </div>
            {protocol.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{protocol.description}</p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {["overview", "steps", "checklist"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {tab === "overview" ? "Overview" : tab === "steps" ? `Steps (${steps.length})` : `Checklist (${checklistItems.length})`}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="space-y-3">
              {(protocol.sections_json || []).length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">No overview sections. Import an SOP to populate this area.</p>
                </div>
              ) : (
                (protocol.sections_json || []).sort((a, b) => a.order - b.order).map(sec => (
                  <SectionCard key={sec.id} section={sec} />
                ))
              )}
            </div>
          )}

          {/* Steps tab */}
          {activeTab === "steps" && (
            <>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {steps.length === 0 ? (
                        <div className="bg-card border border-border rounded-lg p-8 text-center">
                          <p className="text-sm text-muted-foreground">No steps yet.</p>
                        </div>
                      ) : (
                        steps.map((step, index) => (
                          <StepCard
                            key={step.id}
                            step={step}
                            index={index}
                            isAdmin={isAdmin}
                            onTimerSave={handleTimerSave}
                            onTimerRemove={handleTimerRemove}
                            editingMeasurementsStepId={editingMeasurementsStepId}
                            setEditingMeasurementsStepId={setEditingMeasurementsStepId}
                            onMeasurementSave={handleMeasurementSave}
                          />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {isAdmin && (
                <div className="mt-3">
                  {!showAddStep ? (
                    <button onClick={() => setShowAddStep(true)}
                      className="w-full text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add Step
                    </button>
                  ) : (
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">New Step</p>
                      <Input placeholder="Group title (optional)" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                      <Textarea placeholder="Instruction (required)" value={newInstruction} onChange={e => setNewInstruction(e.target.value)} rows={3} />
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={newCritical} onChange={e => setNewCritical(e.target.checked)} className="rounded" />
                        Mark as Critical
                      </label>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddStep} disabled={addingStep || !newInstruction.trim()}>
                          {addingStep ? "Adding..." : "Add Step"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddStep(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Checklist tab */}
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
                    <button onClick={() => setShowAddItem(true)}
                      className="w-full text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  ) : (
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">New Checklist Item</p>
                      <Input placeholder="Item text" value={newItemText} onChange={e => setNewItemText(e.target.value)} />
                      <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card text-foreground">
                        <option value="safety">Safety</option>
                        <option value="equipment">Equipment</option>
                        <option value="reagent">Reagent</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddItem} disabled={addingItem || !newItemText.trim()}>
                          {addingItem ? "Adding..." : "Add Item"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Protocol Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">v{protocol.version || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Steps</span>
                <span className="font-medium">{steps.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Checklist</span>
                <span className="font-medium">{checklistItems.length} items</span>
              </div>
              {protocol.estimated_duration_minutes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Duration</span>
                  <span className="font-medium">{protocol.estimated_duration_minutes}m</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-xs">{new Date(protocol.created_date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={() => navigate(`/pre-run?protocol_id=${protocol.id}`)}>
            <Play className="w-4 h-4 mr-2" />
            Start Run
          </Button>

          {isAdmin && protocol.status !== "active" && (
            <Button variant="outline" className="w-full" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing..." : "Publish Version"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}