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

// ─── StepSettingsPanel ───────────────────────────────────────────────────────
function StepSettingsPanel({ step, onSave, onClose, saving }) {
  const toHMS = (totalSec) => {
    if (!totalSec || totalSec === 0) return { h: 0, m: 0, s: 0 };
    return { h: Math.floor(totalSec / 3600), m: Math.floor((totalSec % 3600) / 60), s: totalSec % 60 };
  };
  const { h: initH, m: initM, s: initS } = toHMS(step.expected_duration_seconds);
  const [h, setH] = useState(initH);
  const [m, setM] = useState(initM);
  const [s, setS] = useState(initS);
  const [timingMode, setTimingMode] = useState(step.timing_mode || 'none');
  const [tolLower, setTolLower] = useState(Math.round((step.tolerance_lower_seconds || 0) / 60));
  const [tolUpper, setTolUpper] = useState(Math.round((step.tolerance_upper_seconds || 0) / 60));
  const [params, setParams] = useState(
    step.measurement_parameters && step.measurement_parameters.length > 0
      ? step.measurement_parameters.map(p => ({ ...p }))
      : []
  );
  const [isCritical, setIsCritical] = useState(step.is_critical || false);

  const totalSeconds = (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0);

  const fmtTime = (sec) => {
    if (!sec || sec === 0) return '0:00';
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    if (hh > 0) return `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  const addParam = () => setParams(prev => [...prev, { name: '', unit: '', min_value: '', max_value: '', required: true }]);
  const removeParam = (idx) => setParams(prev => prev.filter((_, i) => i !== idx));
  const updateParam = (idx, field, value) => setParams(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));

  const handleSave = () => {
    const cleanParams = params
      .filter(p => p.name && p.name.trim().length > 0)
      .map(p => ({
        name: p.name.trim(),
        unit: (p.unit || '').trim(),
        min_value: p.min_value !== '' && p.min_value != null ? parseFloat(p.min_value) : null,
        max_value: p.max_value !== '' && p.max_value != null ? parseFloat(p.max_value) : null,
        required: p.required !== false,
      }));
    onSave(step.id, {
      timing_mode: timingMode,
      expected_duration_seconds: timingMode !== 'none' && totalSeconds > 0 ? totalSeconds : null,
      tolerance_lower_seconds: timingMode === 'strict' ? tolLower * 60 : 0,
      tolerance_upper_seconds: timingMode === 'strict' ? tolUpper * 60 : 0,
      measurement_parameters: cleanParams,
      is_critical: isCritical,
    });
  };

  const inputNumStyle = { width: 52, padding: '6px 4px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, textAlign: 'center', fontWeight: 700, background: 'white', boxSizing: 'border-box' };
  const sectionStyle = { borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 14 };

  return (
    <div style={{ marginTop: 4, padding: '16px 16px 14px', background: '#f8fafc', border: '1px solid #e0e7ff', borderRadius: 10, borderTop: '3px solid #6366f1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Step Settings</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {/* Timer */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timer</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[{ value: 'none', label: 'No Timer' }, { value: 'advisory', label: 'Advisory' }, { value: 'strict', label: 'Strict' }].map(opt => (
            <button key={opt.value} onClick={() => setTimingMode(opt.value)}
              style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: timingMode === opt.value ? (opt.value === 'strict' ? '#dc2626' : opt.value === 'advisory' ? '#1d4ed8' : '#475569') : '#e2e8f0', color: timingMode === opt.value ? 'white' : '#64748b' }}>
              {opt.label}
            </button>
          ))}
          {timingMode !== 'none' && <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center', marginLeft: 4 }}>{timingMode === 'advisory' ? 'Informational countdown' : 'Flags deviation if outside window'}</span>}
        </div>
        {timingMode !== 'none' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <input type="number" min="0" max="23" value={h} onChange={e => setH(Math.max(0, parseInt(e.target.value) || 0))} style={inputNumStyle} />
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>HRS</div>
              </div>
              <span style={{ fontWeight: 700, color: '#94a3b8', paddingBottom: 14, fontSize: 16 }}>:</span>
              <div style={{ textAlign: 'center' }}>
                <input type="number" min="0" max="59" value={m} onChange={e => setM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} style={inputNumStyle} />
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>MIN</div>
              </div>
              <span style={{ fontWeight: 700, color: '#94a3b8', paddingBottom: 14, fontSize: 16 }}>:</span>
              <div style={{ textAlign: 'center' }}>
                <input type="number" min="0" max="59" value={s} onChange={e => setS(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} style={inputNumStyle} />
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>SEC</div>
              </div>
              {totalSeconds > 0 && <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 700, paddingBottom: 14, marginLeft: 4 }}>= {fmtTime(totalSeconds)}</span>}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {[30, 60, 120, 300, 600, 1800, 3600].map(sec => (
                <button key={sec} onClick={() => { setH(Math.floor(sec/3600)); setM(Math.floor((sec%3600)/60)); setS(sec%60); }}
                  style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: 'none', background: totalSeconds === sec ? '#6366f1' : '#e2e8f0', color: totalSeconds === sec ? 'white' : '#64748b', fontWeight: totalSeconds === sec ? 700 : 400 }}>
                  {sec < 60 ? `${sec}s` : sec < 3600 ? `${sec/60}m` : `${sec/3600}h`}
                </button>
              ))}
            </div>
            {timingMode === 'strict' && (
              <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: 7, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tolerance Window</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>EARLY BY (min)</div>
                    <input type="number" min="0" max="60" value={tolLower} onChange={e => setTolLower(Math.max(0, parseInt(e.target.value) || 0))} style={{ ...inputNumStyle, borderColor: '#fecaca' }} />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 12, paddingTop: 16 }}>←→</span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>LATE BY (min)</div>
                    <input type="number" min="0" max="60" value={tolUpper} onChange={e => setTolUpper(Math.max(0, parseInt(e.target.value) || 0))} style={{ ...inputNumStyle, borderColor: '#fecaca' }} />
                  </div>
                  {totalSeconds > 0 && (tolLower > 0 || tolUpper > 0) && (
                    <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, paddingTop: 16 }}>OK: {fmtTime(Math.max(0, totalSeconds - tolLower * 60))} → {fmtTime(totalSeconds + tolUpper * 60)}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Measurements */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Measurement Parameters</div>
          <button onClick={addParam} style={{ padding: '4px 12px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
        </div>
        {params.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No measurement parameters. Click "+ Add" to define what operators should record.</div>}
        {params.map((param, idx) => (
          <div key={idx} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input value={param.name} placeholder="Parameter name *" onChange={e => updateParam(idx, 'name', e.target.value)} style={{ flex: 2, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
              <input value={param.unit} placeholder="Unit" onChange={e => updateParam(idx, 'unit', e.target.value)} style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
              <button onClick={() => removeParam(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 2 }}>MIN</div>
                <input type="number" value={param.min_value ?? ''} placeholder="—" onChange={e => updateParam(idx, 'min_value', e.target.value)} style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 2 }}>MAX</div>
                <input type="number" value={param.max_value ?? ''} placeholder="—" onChange={e => updateParam(idx, 'max_value', e.target.value)} style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 14 }}>
                <input type="checkbox" id={`req_${idx}`} checked={param.required !== false} onChange={e => updateParam(idx, 'required', e.target.checked)} />
                <label htmlFor={`req_${idx}`} style={{ fontSize: 11, color: '#475569', cursor: 'pointer' }}>Required</label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Critical toggle */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical Step</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Operators are alerted and step is highlighted in red during execution</div>
          </div>
          <button onClick={() => setIsCritical(prev => !prev)}
            style={{ padding: '6px 16px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: `1px solid ${isCritical ? '#fecaca' : '#e2e8f0'}`, cursor: 'pointer', background: isCritical ? '#fef2f2' : '#f1f5f9', color: isCritical ? '#dc2626' : '#64748b' }}>
            {isCritical ? '⚠ Critical — click to remove' : 'Mark as Critical'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={saving} style={{ padding: '8px 18px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#475569' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : '✓ Save Settings'}</button>
      </div>
    </div>
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

  const [editingStepId, setEditingStepId] = useState(null);
  const [editingStepTitle, setEditingStepTitle] = useState("");
  const [editingStepInstruction, setEditingStepInstruction] = useState("");
  const [confirmDeleteStepId, setConfirmDeleteStepId] = useState(null);
  const [stepError, setStepError] = useState("");
  const [settingsOpenStepId, setSettingsOpenStepId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [editingOverview, setEditingOverview] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editClassification, setEditClassification] = useState('');
  const [editEstimatedDuration, setEditEstimatedDuration] = useState('');
  const [savingOverview, setSavingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  const [confirmDeleteChecklistId, setConfirmDeleteChecklistId] = useState(null);
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [editingChecklistCategory, setEditingChecklistCategory] = useState('other');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('reagent');
  const [checklistError, setChecklistError] = useState('');

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

  const handleSaveStepSettings = async (stepId, settings) => {
    setSavingSettings(true);
    try {
      await base44.entities.ProtocolStep.update(stepId, {
        timing_mode: settings.timing_mode,
        expected_duration_seconds: settings.expected_duration_seconds,
        tolerance_lower_seconds: settings.tolerance_lower_seconds,
        tolerance_upper_seconds: settings.tolerance_upper_seconds,
        measurement_parameters: settings.measurement_parameters,
        is_critical: settings.is_critical,
      });
      const fresh = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      setSteps(fresh.sort((a, b) => a.step_order - b.step_order));
      setSettingsOpenStepId(null);
    } catch(e) {
      console.error('Settings save failed:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  async function handleSaveStepEdit(stepId) {
    await base44.entities.ProtocolStep.update(stepId, { title: editingStepTitle.trim() || null, instruction: editingStepInstruction.trim() });
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, title: editingStepTitle.trim() || null, instruction: editingStepInstruction.trim() } : s));
    setEditingStepId(null);
  }

  function handleDeleteStep(stepId) {
    setConfirmDeleteStepId(stepId);
  }

  async function handleConfirmDeleteStep(stepId) {
    setConfirmDeleteStepId(null);
    try {
      await base44.entities.ProtocolStep.delete(stepId);
      const freshSteps = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      const sortedFresh = freshSteps.sort((a, b) => a.step_order - b.step_order);
      await Promise.all(sortedFresh.map((s, i) => base44.entities.ProtocolStep.update(s.id, { step_order: i + 1 })));
      const reloaded = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      setSteps(reloaded.sort((a, b) => a.step_order - b.step_order));
    } catch(e) {
      console.error('Delete step failed:', e);
      setStepError('Failed to delete step: ' + (e.message || 'Unknown error'));
    }
  }

  async function handleAddStep(afterStepOrder = null) {
    try {
      const freshSteps = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      const sortedFresh = freshSteps.sort((a, b) => a.step_order - b.step_order);
      const insertAt = afterStepOrder !== null ? afterStepOrder + 1 : sortedFresh.length + 1;
      const stepsToShift = sortedFresh.filter(s => s.step_order >= insertAt);
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
      const reloaded = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      setSteps(reloaded.sort((a, b) => a.step_order - b.step_order));
      setEditingStepId(newStep.id);
      setEditingStepTitle("");
      setEditingStepInstruction("New step — click to edit");
    } catch(e) {
      console.error('Add step failed:', e);
      setStepError('Failed to add step: ' + (e.message || 'Unknown error'));
    }
  }

  async function handleDuplicateStep(step) {
    try {
      const freshSteps = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      const sortedFresh = freshSteps.sort((a, b) => a.step_order - b.step_order);
      const insertAt = step.step_order + 1;
      const stepsToShift = sortedFresh.filter(s => s.step_order >= insertAt && s.id !== step.id);
      await Promise.all(stepsToShift.map(s => base44.entities.ProtocolStep.update(s.id, { step_order: s.step_order + 1 })));
      await base44.entities.ProtocolStep.create({
        organization_id: orgId,
        protocol_id: protocol.id,
        step_order: insertAt,
        title: step.title || "",
        instruction: step.instruction || "",
        is_critical: step.is_critical || false,
        timing_mode: step.timing_mode || "none",
        expected_duration_seconds: step.expected_duration_seconds || null,
        tolerance_lower_seconds: step.tolerance_lower_seconds || 0,
        tolerance_upper_seconds: step.tolerance_upper_seconds || 0,
        requires_measurement: step.requires_measurement || false,
        measurement_parameters: step.measurement_parameters || [],
      });
      const reloaded = await base44.entities.ProtocolStep.filter({ protocol_id: protocol.id, organization_id: orgId });
      setSteps(reloaded.sort((a, b) => a.step_order - b.step_order));
    } catch(e) {
      console.error('Duplicate step failed:', e);
      setStepError('Failed to duplicate step: ' + (e.message || 'Unknown error'));
    }
  }



  const handleDeleteChecklistItem = (itemId) => setConfirmDeleteChecklistId(itemId);

  const handleConfirmDeleteChecklistItem = async (itemId) => {
    setConfirmDeleteChecklistId(null);
    try {
      await base44.entities.ProtocolChecklistItem.delete(itemId);
      const fresh = await base44.entities.ProtocolChecklistItem.filter({ protocol_id: protocol.id, organization_id: orgId });
      setChecklistItems(fresh.sort((a, b) => (a.item_order || 0) - (b.item_order || 0)));
    } catch(e) {
      setChecklistError('Failed to delete item. Please try again.');
    }
  };

  const handleSaveChecklistEdit = async (itemId) => {
    if (!editingChecklistText.trim()) return;
    try {
      await base44.entities.ProtocolChecklistItem.update(itemId, { item_text: editingChecklistText.trim(), category: editingChecklistCategory });
      const fresh = await base44.entities.ProtocolChecklistItem.filter({ protocol_id: protocol.id, organization_id: orgId });
      setChecklistItems(fresh.sort((a, b) => (a.item_order || 0) - (b.item_order || 0)));
      setEditingChecklistId(null);
    } catch(e) {
      setChecklistError('Failed to save. Please try again.');
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistText.trim()) return;
    try {
      const maxOrder = checklistItems.reduce((max, i) => Math.max(max, i.item_order || 0), 0);
      await base44.entities.ProtocolChecklistItem.create({ organization_id: orgId, protocol_id: protocol.id, item_text: newChecklistText.trim(), category: newChecklistCategory, item_order: maxOrder + 1 });
      const fresh = await base44.entities.ProtocolChecklistItem.filter({ protocol_id: protocol.id, organization_id: orgId });
      setChecklistItems(fresh.sort((a, b) => (a.item_order || 0) - (b.item_order || 0)));
      setNewChecklistText('');
      setNewChecklistCategory('reagent');
      setAddingChecklistItem(false);
    } catch(e) {
      setChecklistError('Failed to add item. Please try again.');
    }
  };

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

  const handleStartEditOverview = () => {
    setEditName(protocol.name || '');
    setEditDescription(protocol.description || '');
    setEditClassification(protocol.classification || 'Academic Research');
    setEditEstimatedDuration(protocol.estimated_duration_minutes ? String(protocol.estimated_duration_minutes) : '');
    setOverviewError('');
    setEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (!editName.trim()) { setOverviewError('Protocol name is required.'); return; }
    setSavingOverview(true);
    setOverviewError('');
    try {
      const user = await base44.auth.me();
      const updatedSectionsJson = (protocol.sections_json || []).map(section =>
        section.type === 'purpose'
          ? { ...section, items: editDescription.trim() ? editDescription.trim().split('\n').filter(l => l.trim().length > 0) : [] }
          : section
      );
      const hasPurpose = updatedSectionsJson.some(s => s.type === 'purpose');
      if (!hasPurpose && editDescription.trim()) {
        updatedSectionsJson.unshift({ id: 'sec_purpose', type: 'purpose', title: 'Purpose', order: -1, items: editDescription.trim().split('\n').filter(l => l.trim().length > 0), subsections: [] });
      }
      await base44.entities.Protocol.update(protocol.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        classification: editClassification,
        estimated_duration_minutes: editEstimatedDuration ? parseInt(editEstimatedDuration) : null,
        sections_json: updatedSectionsJson,
      });
      await base44.entities.AuditLog.create({
        organization_id: orgId, entity_type: 'Protocol', entity_id: protocol.id,
        event_type: 'protocol_updated', actor_user_id: user.id, actor_email: user.email,
        metadata: { fields_updated: ['name', 'description', 'classification', 'estimated_duration_minutes'] },
        created_at: new Date().toISOString(),
      });
      setProtocol(prev => ({ ...prev, name: editName.trim(), description: editDescription.trim(), classification: editClassification, estimated_duration_minutes: editEstimatedDuration ? parseInt(editEstimatedDuration) : null, sections_json: updatedSectionsJson }));
      setEditingOverview(false);
    } catch(e) {
      setOverviewError('Failed to save. Please try again.');
    } finally {
      setSavingOverview(false);
    }
  };

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
      {!isAdmin && (
        <div style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, marginBottom: 14, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>👁</span>
          <span>You have read-only access to this protocol. Contact your lab admin to make changes.</span>
        </div>
      )}
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
            <div>
              {overviewError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{overviewError}</span>
                  <button onClick={() => setOverviewError('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              )}

              {/* Protocol metadata card */}
              <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Protocol Details</div>
                  {isAdmin && !editingOverview && (
                    <button onClick={handleStartEditOverview} style={{ padding: '5px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>✏ Edit</button>
                  )}
                </div>

                {!editingOverview && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Name</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{protocol.name}</div>
                    </div>
                    {protocol.description && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Purpose / Description</div>
                        <div style={{ fontSize: 13, color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{protocol.description}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Classification</div>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>{protocol.classification}</span>
                      </div>
                      {protocol.estimated_duration_minutes && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Est. Duration</div>
                          <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>⏱ {protocol.estimated_duration_minutes} min</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Version</div>
                        <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>v{protocol.version || 1}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Status</div>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: protocol.status === 'active' ? '#f0fdf4' : protocol.status === 'archived' ? '#f1f5f9' : '#fffbeb', color: protocol.status === 'active' ? '#16a34a' : protocol.status === 'archived' ? '#64748b' : '#d97706', border: `1px solid ${protocol.status === 'active' ? '#bbf7d0' : protocol.status === 'archived' ? '#e2e8f0' : '#fde68a'}` }}>{protocol.status || 'draft'}</span>
                      </div>
                    </div>
                    {protocol.compliance_tags && protocol.compliance_tags.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Compliance</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {protocol.compliance_tags.map(tag => (
                            <span key={tag} style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {editingOverview && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protocol Name *</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Protocol name" style={{ width: '100%', padding: '8px 12px', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purpose / Description</label>
                      <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Describe the purpose and scope of this protocol..." rows={4} style={{ width: '100%', padding: '8px 12px', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.6' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Classification</label>
                        <select value={editClassification} onChange={e => setEditClassification(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 13, background: 'white', boxSizing: 'border-box' }}>
                          {['Academic Research','Clinical Diagnostic','GMP Manufacturing','ISO Accredited','CRO Study','Biotech Startup','General'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Duration (minutes)</label>
                        <input type="number" min="0" value={editEstimatedDuration} onChange={e => setEditEstimatedDuration(e.target.value)} placeholder="e.g. 45" style={{ width: '100%', padding: '8px 10px', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                      <button onClick={() => { setEditingOverview(false); setOverviewError(''); }} disabled={savingOverview} style={{ padding: '7px 18px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                      <button onClick={handleSaveOverview} disabled={savingOverview || !editName.trim()} style={{ padding: '7px 20px', background: savingOverview || !editName.trim() ? '#94a3b8' : '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: savingOverview || !editName.trim() ? 'not-allowed' : 'pointer' }}>{savingOverview ? 'Saving...' : '✓ Save Changes'}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Non-materials, non-purpose sections from sections_json */}
              {(protocol.sections_json || []).filter(s => s.type !== 'materials' && s.type !== 'purpose').map(section => {
                const SECTION_CONFIG = {
                  data_analysis: { icon: '📊', color: '#8b5cf6', border: '#c4b5fd', bg: '#faf5ff' },
                  controls:      { icon: '✅', color: '#f59e0b', border: '#fde68a', bg: '#fffbeb' },
                  risk:          { icon: '⚠️', color: '#ef4444', border: '#fecaca', bg: '#fef2f2' },
                  general:       { icon: '📄', color: '#64748b', border: '#e2e8f0', bg: '#f8fafc' },
                };
                const cfg = SECTION_CONFIG[section.type] || SECTION_CONFIG.general;
                if (!section.items || section.items.length === 0) return null;
                return (
                  <div key={section.id} style={{ background: cfg.bg, borderRadius: 10, border: `1px solid ${cfg.border}`, borderLeft: `4px solid ${cfg.color}`, padding: '14px 16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span>{cfg.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section.title}</span>
                    </div>
                    {section.items.map((item, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#475569', lineHeight: '1.6', marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${cfg.border}` }}>{item}</div>
                    ))}
                  </div>
                );
              })}

              {/* Materials — live from checklistItems */}
              {checklistItems.length > 0 && (
                <div style={{ background: 'white', borderRadius: 10, border: '1px solid #bbf7d0', borderLeft: '4px solid #10b981', padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span>🧪</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Materials & Equipment</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>({checklistItems.length} items)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {[{cat:'safety',label:'🛡 Safety',color:'#dc2626',border:'#fecaca'},{cat:'equipment',label:'⚙️ Equipment',color:'#1d4ed8',border:'#bfdbfe'},{cat:'reagent',label:'🧪 Reagents',color:'#16a34a',border:'#bbf7d0'},{cat:'other',label:'📋 Other',color:'#475569',border:'#e2e8f0'}].map(({cat,label,color,border}) => {
                      const items = checklistItems.filter(i => i.category === cat);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat}>
                          <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label} ({items.length})</div>
                          {items.map(item => (
                            <div key={item.id} style={{ fontSize: 12, color: '#475569', padding: '2px 0 2px 8px', borderLeft: `2px solid ${border}`, marginBottom: 3 }}>{item.item_text}</div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "steps" && (
            <>
              {stepError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{stepError}</span>
                  <button onClick={() => setStepError('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              )}
              <div>
                {(() => {
                  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
                  const rendered = [];
                  let lastTitle = null;

                  sortedSteps.forEach((step, index) => {
                    const stepTitle = step.title?.trim() || null;
                    const showGroupHeader = stepTitle && stepTitle !== lastTitle;

                    if (showGroupHeader) {
                      rendered.push(
                        <div key={`header_${step.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 6px', marginTop: index === 0 ? 0 : 12 }}>
                          <div style={{ flex: 1, height: 1, background: '#e0e7ff' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', padding: '2px 10px', background: '#eef2ff', borderRadius: 99 }}>
                            {stepTitle}
                          </span>
                          <div style={{ flex: 1, height: 1, background: '#e0e7ff' }} />
                        </div>
                      );
                      lastTitle = stepTitle;
                    }

                    rendered.push(
                      <div key={step.id} style={{ background: step.is_critical ? '#fff8f8' : 'white', border: `1px solid ${step.is_critical ? '#fecaca' : '#e2e8f0'}`, borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: step.is_critical ? '#ef4444' : '#6366f1', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {step.step_order}
                          </div>
                          {editingStepId !== step.id ? (
                            <div
                              onClick={() => { if (!isAdmin) return; setEditingStepId(step.id); setEditingStepTitle(step.title || ''); setEditingStepInstruction(step.instruction || ''); }}
                              title={isAdmin ? 'Click to edit' : ''}
                              style={{ flex: 1, fontSize: 13, color: '#1e293b', lineHeight: '1.5', whiteSpace: 'pre-line', cursor: isAdmin ? 'text' : 'default', padding: '2px 4px', borderRadius: 4, border: '1px solid transparent' }}
                              onMouseEnter={e => { if (isAdmin) e.currentTarget.style.borderColor = '#e0e7ff'; }}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                            >
                              {step.instruction}
                            </div>
                          ) : (
                            <div style={{ flex: 1 }}>
                              <input value={editingStepTitle} onChange={e => setEditingStepTitle(e.target.value)} placeholder="Group title (optional)" style={{ width: '100%', padding: '4px 7px', border: '1px solid #c7d2fe', borderRadius: 5, fontSize: 11, fontWeight: 600, marginBottom: 5, boxSizing: 'border-box' }} />
                              <textarea value={editingStepInstruction} onChange={e => setEditingStepInstruction(e.target.value)} rows={2} style={{ width: '100%', padding: '5px 7px', border: '1px solid #c7d2fe', borderRadius: 5, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                              <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                                <button onClick={() => setEditingStepId(null)} style={{ padding: '4px 10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                                <button onClick={() => handleSaveStepEdit(step.id)} style={{ padding: '4px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            {step.is_critical && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>⚠ CRITICAL</span>
                            )}
                            {step.timing_mode !== 'none' && step.expected_duration_seconds > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: step.timing_mode === 'strict' ? '#fef2f2' : '#eff6ff', color: step.timing_mode === 'strict' ? '#dc2626' : '#1d4ed8', border: `1px solid ${step.timing_mode === 'strict' ? '#fecaca' : '#bfdbfe'}` }}>
                                ⏱ {step.expected_duration_seconds >= 3600 ? `${Math.floor(step.expected_duration_seconds/3600)}h${Math.floor((step.expected_duration_seconds%3600)/60) > 0 ? ` ${Math.floor((step.expected_duration_seconds%3600)/60)}m` : ''}` : step.expected_duration_seconds >= 60 ? `${Math.floor(step.expected_duration_seconds/60)}m` : `${step.expected_duration_seconds}s`}
                                {step.timing_mode === 'strict' && ' · S'}
                              </span>
                            )}
                            {step.measurement_parameters?.length > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>📏 {step.measurement_parameters.length}</span>
                            )}
                            {isAdmin && editingStepId !== step.id && (
                              <>
                                <button onClick={() => setSettingsOpenStepId(settingsOpenStepId === step.id ? null : step.id)} title="Step settings"
                                  style={{ background: settingsOpenStepId === step.id ? '#eef2ff' : 'none', border: `1px solid ${settingsOpenStepId === step.id ? '#c7d2fe' : 'transparent'}`, cursor: 'pointer', color: settingsOpenStepId === step.id ? '#6366f1' : '#94a3b8', fontSize: 14, padding: '3px 7px', borderRadius: 5 }}
                                  onMouseEnter={e => { if (settingsOpenStepId !== step.id) { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}}
                                  onMouseLeave={e => { if (settingsOpenStepId !== step.id) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'transparent'; }}}
                                >⚙</button>
                                <button onClick={() => handleDuplicateStep(step)} title="Duplicate"
                                  style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 13, padding: '3px 7px', borderRadius: 5 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >⧉</button>
                                {confirmDeleteStepId === step.id ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#fef2f2', borderRadius: 5, border: '1px solid #fecaca' }}>
                                    <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                                    <button onClick={() => handleConfirmDeleteStep(step.id)} style={{ padding: '2px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                                    <button onClick={() => setConfirmDeleteStepId(null)} style={{ padding: '2px 8px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>No</button>
                                  </div>
                                ) : (
                                  <button onClick={() => handleDeleteStep(step.id)} title="Delete"
                                    style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 15, padding: '3px 7px', borderRadius: 5 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'transparent'; }}
                                  >×</button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Settings panel */}
                        {settingsOpenStepId === step.id && (
                          <div style={{ padding: '0 12px 12px' }}>
                            <StepSettingsPanel step={step} onSave={handleSaveStepSettings} onClose={() => setSettingsOpenStepId(null)} saving={savingSettings} />
                          </div>
                        )}

                        {/* Insert between steps */}
                        {index < sortedSteps.length - 1 && isAdmin && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px' }}>
                            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                            <button onClick={() => handleAddStep(step.step_order)} style={{ fontSize: 10, color: '#94a3b8', background: 'white', border: '1px solid #e2e8f0', borderRadius: 99, padding: '1px 8px', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#6366f1'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>+ insert</button>
                            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                          </div>
                        )}
                      </div>
                    );
                  });

                  return rendered;
                })()}
              </div>

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
            <div>
              {checklistError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{checklistError}</span>
                  <button onClick={() => setChecklistError('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Checklist Items ({checklistItems.length})</div>
                {isAdmin && !addingChecklistItem && (
                  <button onClick={() => setAddingChecklistItem(true)} style={{ padding: '6px 14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Item</button>
                )}
              </div>
              {addingChecklistItem && (
                <div style={{ padding: '14px 16px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', marginBottom: 10 }}>NEW CHECKLIST ITEM</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select value={newChecklistCategory} onChange={e => setNewChecklistCategory(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 12, background: 'white', flexShrink: 0 }}>
                      <option value="safety">Safety</option>
                      <option value="equipment">Equipment</option>
                      <option value="reagent">Reagent</option>
                      <option value="other">Other</option>
                    </select>
                    <input value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()} placeholder="e.g. RNA extraction kit — Lot#, Expiry" autoFocus style={{ flex: 1, padding: '7px 10px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setAddingChecklistItem(false); setNewChecklistText(''); }} style={{ padding: '6px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                    <button onClick={handleAddChecklistItem} disabled={!newChecklistText.trim()} style={{ padding: '6px 16px', background: newChecklistText.trim() ? '#6366f1' : '#94a3b8', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: newChecklistText.trim() ? 'pointer' : 'not-allowed' }}>Add Item</button>
                  </div>
                </div>
              )}
              {['safety', 'equipment', 'reagent', 'other'].map(category => {
                const categoryItems = checklistItems.filter(item => item.category === category);
                if (categoryItems.length === 0) return null;
                const CATEGORY_CONFIG = {
                  safety:    { label: 'Safety',    icon: '🛡', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', badge: '#fee2e2' },
                  equipment: { label: 'Equipment', icon: '⚙️',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', badge: '#dbeafe' },
                  reagent:   { label: 'Reagents',  icon: '🧪', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', badge: '#dcfce7' },
                  other:     { label: 'Other',     icon: '📋', color: '#475569', bg: '#f8fafc', border: '#e2e8f0', badge: '#f1f5f9' },
                };
                const cfg = CATEGORY_CONFIG[category];
                return (
                  <div key={category} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${cfg.border}` }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: cfg.badge, color: cfg.color }}>{categoryItems.length}</span>
                    </div>
                    {categoryItems.map(item => (
                      <div key={item.id} style={{ background: 'white', border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 7, marginBottom: 6, overflow: 'hidden' }}>
                        {editingChecklistId !== item.id && confirmDeleteChecklistId !== item.id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.icon}</span>
                            <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{item.item_text}</span>
                            {isAdmin && (
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button onClick={() => { setEditingChecklistId(item.id); setEditingChecklistText(item.item_text); setEditingChecklistCategory(item.category); }} title="Edit item" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 12, padding: '2px 6px', borderRadius: 4, opacity: 0.6 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>✏</button>
                                <button onClick={() => handleDeleteChecklistItem(item.id)} title="Delete item" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 15, padding: '2px 6px', borderRadius: 4, opacity: 0.6 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>×</button>
                              </div>
                            )}
                          </div>
                        )}
                        {confirmDeleteChecklistId === item.id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#fef2f2' }}>
                            <span style={{ flex: 1, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Delete "{item.item_text.substring(0, 40)}{item.item_text.length > 40 ? '...' : ''}"?</span>
                            <button onClick={() => handleConfirmDeleteChecklistItem(item.id)} style={{ padding: '4px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Yes, delete</button>
                            <button onClick={() => setConfirmDeleteChecklistId(null)} style={{ padding: '4px 12px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
                          </div>
                        )}
                        {editingChecklistId === item.id && (
                          <div style={{ padding: '10px 12px', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <select value={editingChecklistCategory} onChange={e => setEditingChecklistCategory(e.target.value)} style={{ padding: '6px 8px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 12, background: 'white', flexShrink: 0 }}>
                                <option value="safety">Safety</option>
                                <option value="equipment">Equipment</option>
                                <option value="reagent">Reagent</option>
                                <option value="other">Other</option>
                              </select>
                              <input value={editingChecklistText} onChange={e => setEditingChecklistText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveChecklistEdit(item.id)} autoFocus style={{ flex: 1, padding: '6px 10px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => setEditingChecklistId(null)} style={{ padding: '5px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                              <button onClick={() => handleSaveChecklistEdit(item.id)} disabled={!editingChecklistText.trim()} style={{ padding: '5px 14px', background: editingChecklistText.trim() ? '#6366f1' : '#94a3b8', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              {checklistItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 13 }}>
                  No checklist items yet.{isAdmin && <span> Click "+ Add Item" to add reagents, equipment and safety items.</span>}
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