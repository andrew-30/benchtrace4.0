import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, FileText, ChevronRight, AlertCircle,
  Beaker, Wrench, Shield, Tag, GripVertical, X, Plus, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";

// ── Parser utilities ────────────────────────────────────────────────────────

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function classifySection(title) {
  const t = title.toLowerCase();
  if (t.includes("purpose") || t.includes("objective") || t.includes("scope")) return "purpose";
  if (t.includes("material") || t.includes("equipment") || t.includes("reagent")) return "materials";
  if (t.includes("procedure") || t.includes("method") || t.includes("steps") || t.includes("instructions") || t.includes("protocol")) return "procedure";
  if (t.includes("analysis") || t.includes("data") || t.includes("results") || t.includes("calculations")) return "data_analysis";
  if (t.includes("control") || t.includes("qc") || t.includes("quality")) return "controls";
  if (t.includes("risk") || t.includes("hazard") || t.includes("safety") || t.includes("precaution")) return "risk";
  if (t.includes("reference") || t.includes("appendix")) return "references";
  return "general";
}

function detectStructuredSections(text) {
  const lines = text.split("\n").map(l => l.trim());
  const sectionPattern = /^\d+\.\s+(.+)/;
  const subsectionPattern = /^\d+\.\d+\.?\s+(.+)/;
  const bulletPattern = /^(\d+[.)]\s+|[-•*]\s+)/;
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;

  for (const line of lines) {
    if (!line) continue;
    const subsectionMatch = line.match(subsectionPattern);
    const sectionMatch = !subsectionMatch && line.match(sectionPattern);

    if (sectionMatch) {
      currentSection = { title: sectionMatch[1].trim(), type: classifySection(sectionMatch[1]), content: [], subsections: [] };
      sections.push(currentSection);
      currentSubsection = null;
    } else if (subsectionMatch && currentSection) {
      currentSubsection = { title: subsectionMatch[1].trim(), steps: [] };
      currentSection.subsections.push(currentSubsection);
    } else if (bulletPattern.test(line)) {
      const cleaned = line.replace(bulletPattern, "").trim();
      if (cleaned.length > 2) {
        if (currentSubsection) currentSubsection.steps.push(cleaned);
        else if (currentSection) currentSection.content.push(cleaned);
      }
    } else if (line.length > 2) {
      if (currentSection) currentSection.content.push(line);
    }
  }
  return sections;
}

function extractMaterials(lines) {
  const EQUIP = ["centrifuge","pipette","vortex","microscope","incubator","balance","scale","plate reader","thermocycler","spectrophotometer","mixer","oven","freezer","hood","instrument","device","machine","equipment","analyzer","timer"];
  const SAFETY = ["ppe","glove","goggle","mask","fume hood","safety","hazard","toxic","biosafety","lab coat","protective"];
  const reagents = [], equipment = [], safety = [];
  for (const line of lines) {
    const clean = line.replace(/^[•\-*\d.)]+\s*/, "").trim();
    if (clean.length < 3 || /^(reagents?|equipment|materials?|supplies?):?$/i.test(clean)) continue;
    const lower = clean.toLowerCase();
    if (SAFETY.some(k => lower.includes(k))) safety.push(clean);
    else if (EQUIP.some(k => lower.includes(k))) equipment.push(clean);
    else reagents.push(clean);
  }
  return { reagents, equipment, safety };
}

function parseDuration(text) {
  const m = text.match(/(\d+(?:[–\-]\d+)?)\s*(min(?:utes?)?|hr?s?|hours?|sec(?:onds?)?)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("sec")) return Math.round(val);
  if (unit.startsWith("min")) return Math.round(val * 60);
  if (unit.startsWith("h")) return Math.round(val * 3600);
  return null;
}

function parseProtocolDocument(text, classification, granularity = "individual") {
  const normalized = normalizeText(text);
  const sections = detectStructuredSections(normalized);

  let procedureSection = sections.find(s => s.type === "procedure");
  let steps = [];

  if (procedureSection) {
    if (granularity === "individual" && procedureSection.subsections.length > 0) {
      let order = 1;
      for (const sub of procedureSection.subsections) {
        for (const bullet of sub.steps) {
          steps.push({ step_order: order++, title: sub.title.substring(0, 60), instruction: bullet, is_critical: /critical|warning|caution|must not|do not|danger/i.test(bullet), estimated_duration_seconds: parseDuration(bullet), requires_measurement: /measure|record|calculate|absorbance/i.test(bullet), _id: `s_${order}` });
        }
      }
      for (const item of procedureSection.content) {
        if (item.length > 5) steps.push({ step_order: steps.length + 1, title: null, instruction: item, is_critical: /critical|warning|caution/i.test(item), estimated_duration_seconds: parseDuration(item), _id: `s_${steps.length}` });
      }
    } else {
      let order = 1;
      for (const sub of procedureSection.subsections) {
        const instruction = sub.steps.length > 0 ? "• " + sub.steps.join("\n• ") : sub.title;
        steps.push({ step_order: order++, title: sub.title.substring(0, 60), instruction, is_critical: /critical|warning|caution/i.test(instruction), estimated_duration_seconds: parseDuration(instruction), _id: `s_${order}` });
      }
      for (const item of procedureSection.content) {
        if (item.length > 5) steps.push({ step_order: steps.length + 1, title: null, instruction: item, is_critical: false, estimated_duration_seconds: parseDuration(item), _id: `s_${steps.length}` });
      }
    }
  }

  if (steps.length === 0) {
    const allLines = normalized.split("\n").filter(l => l.trim().length > 10);
    steps = allLines.slice(0, 20).map((l, i) => ({ step_order: i + 1, title: null, instruction: l.trim(), is_critical: false, estimated_duration_seconds: null, _id: `s_${i}` }));
  }

  const matSection = sections.find(s => s.type === "materials");
  const matLines = matSection ? [...matSection.content, ...matSection.subsections.flatMap(s => s.steps)] : [];
  const structuredMaterials = extractMaterials(matLines);

  const checklistItems = [
    ...(structuredMaterials.safety || []).map((t, i) => ({ item_text: t, category: "safety", _id: `cs_${i}` })),
    ...(structuredMaterials.equipment || []).map((t, i) => ({ item_text: t, category: "equipment", _id: `ce_${i}` })),
    ...(structuredMaterials.reagents || []).map((t, i) => ({ item_text: t, category: "reagent", _id: `cr_${i}` })),
  ];

  const hasProc = !!procedureSection;
  const hasMat = !!matSection;
  const confidence = hasProc && hasMat ? "high" : hasProc || hasMat ? "medium" : "low";

  const allLines = normalized.split("\n").filter(l => l.trim().length > 5 && l.trim().length < 120);
  const genericPattern = /^(standard operating procedure|sop|protocol|procedure|method|document)/i;
  let name = allLines[0] || "Imported Protocol";
  if (genericPattern.test(name) && allLines[1]) name = allLines[1];
  name = name.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "").trim();

  const sectionsJson = sections.filter(s => s.type !== "procedure" && s.type !== "references").map((s, i) => {
    if (s.type === "materials") {
      return { id: `sec_${i}`, type: "materials", title: "Materials & Equipment", order: i, items: [], subsections: [
        { id: "sub_r", type: "reagents", title: "Reagents", order: 0, items: structuredMaterials.reagents || [] },
        { id: "sub_e", type: "equipment", title: "Equipment", order: 1, items: structuredMaterials.equipment || [] },
        ...(structuredMaterials.safety?.length ? [{ id: "sub_s", type: "safety", title: "Safety", order: 2, items: structuredMaterials.safety }] : []),
      ]};
    }
    return { id: `sec_${i}`, type: s.type, title: s.title, order: i, items: [...s.content, ...s.subsections.flatMap(sub => sub.steps)].filter(x => x.length > 2), subsections: [] };
  });

  const textLower = normalized.toLowerCase();
  const complianceTags = [];
  if (textLower.includes("gmp")) complianceTags.push("GMP");
  if (textLower.includes("glp")) complianceTags.push("GLP");
  if (textLower.includes("iso")) complianceTags.push("ISO");
  if (textLower.includes("clia")) complianceTags.push("CLIA");
  if (textLower.includes("21 cfr")) complianceTags.push("21 CFR Part 11");

  const totalSec = steps.reduce((s, st) => s + (st.estimated_duration_seconds || 0), 0);

  return {
    name: name.trim(),
    description: sections.find(s => s.type === "purpose")?.content.join(" ").substring(0, 300) || "",
    classification: classification || "Academic Research",
    compliance_tags: [...new Set(complianceTags)],
    estimated_duration_minutes: totalSec >= 300 ? Math.round(totalSec / 60) : null,
    steps,
    checklist_items: checklistItems,
    sections_json: sectionsJson,
    structured_materials: structuredMaterials,
    _confidence: confidence,
  };
}

async function extractDocxText(file) {
  if (!window.JSZip) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  return xml
    .replace(/<w:br[^>]*\/>/gi, "\n").replace(/<w:p[^>]*>/gi, "\n")
    .replace(/<\/w:p>/gi, "").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x2013;/g, "–").replace(/&#x2019;/g, "'");
}

// ── Sector cards data ────────────────────────────────────────────────────────

const SECTORS = [
  { name: "Academic Research", desc: "University labs, research institutes" },
  { name: "Clinical Diagnostic", desc: "Hospital labs, diagnostic testing" },
  { name: "GMP Manufacturing", desc: "FDA-regulated manufacturing" },
  { name: "ISO Accredited", desc: "ISO 17025, 15189 labs" },
  { name: "CRO Study", desc: "Contract research organizations" },
  { name: "Biotech Startup", desc: "Early-stage biotech companies" },
  { name: "General", desc: "General lab, not sure" },
];

const CONFIDENCE_STYLES = {
  high: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-red-50 text-red-700 border border-red-200",
};

const SECTION_BORDER = {
  purpose: "border-l-4 border-l-indigo-400",
  materials: "border-l-4 border-l-emerald-400",
  controls: "border-l-4 border-l-blue-400",
  risk: "border-l-4 border-l-red-400",
  data_analysis: "border-l-4 border-l-amber-400",
  general: "border-l-4 border-l-gray-300",
};

// ── Step row in review ────────────────────────────────────────────────────────
function StepRow({ step, onDelete }) {
  return (
    <div className="flex items-start gap-2 py-2 group">
      <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
        {step.step_order}
      </span>
      <div className="flex-1 min-w-0">
        {step.title && <p className="text-xs font-semibold text-primary uppercase">{step.title}</p>}
        <p className="text-sm text-foreground whitespace-pre-line">{step.instruction}</p>
        {step.is_critical && (
          <span className="text-xs text-red-600 font-medium">Critical</span>
        )}
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Import() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const orgId = localStorage.getItem("bt_org_id");

  const [step, setStep] = useState(1);
  const [classification, setClassification] = useState("");
  const [inputMode, setInputMode] = useState("upload"); // upload | paste
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [granularity, setGranularity] = useState("individual");
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Review state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editSections, setEditSections] = useState([]);
  const [editSteps, setEditSteps] = useState([]);
  const [editChecklist, setEditChecklist] = useState([]);

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleProcess() {
    if (inputMode === "upload" && !file) return;
    if (inputMode === "paste" && !pasteText.trim()) return;

    setProcessing(true);
    setStep(3);
    setError("");

    let text = "";
    if (inputMode === "upload") {
      if (file.name.endsWith(".docx")) {
        text = await extractDocxText(file);
      } else {
        text = await file.text();
      }
    } else {
      text = pasteText;
    }

    const result = parseProtocolDocument(text, classification, granularity);
    setParsed(result);
    setEditName(result.name);
    setEditDesc(result.description);
    setEditClass(result.classification);
    setEditDuration(result.estimated_duration_minutes ? String(result.estimated_duration_minutes) : "");
    setEditSections(result.sections_json || []);
    setEditSteps(result.steps || []);
    setEditChecklist(result.checklist_items || []);
    setProcessing(false);
    setStep(4);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const user = await base44.auth.me();

    const protocol = await base44.entities.Protocol.create({
      organization_id: orgId,
      name: editName,
      description: editDesc || "",
      classification: editClass,
      compliance_tags: parsed.compliance_tags || [],
      sections_json: editSections,
      estimated_duration_minutes: editDuration ? parseInt(editDuration) : null,
      status: "draft",
      version: 1,
      created_by_id: user.id,
    });

    if (editSteps.length > 0) {
      await Promise.all(editSteps.map(s => base44.entities.ProtocolStep.create({
        organization_id: orgId,
        protocol_id: protocol.id,
        step_order: s.step_order,
        title: s.title || "",
        instruction: s.instruction,
        is_critical: s.is_critical || false,
        timing_mode: s.estimated_duration_seconds ? "advisory" : "none",
        expected_duration_seconds: s.estimated_duration_seconds || null,
        requires_measurement: s.requires_measurement || false,
      })));
    }

    if (editChecklist.length > 0) {
      await Promise.all(editChecklist.map((item, i) => base44.entities.ProtocolChecklistItem.create({
        organization_id: orgId,
        protocol_id: protocol.id,
        item_order: i + 1,
        item_text: item.item_text,
        category: item.category || "other",
      })));
    }

    await base44.entities.AuditLog.create({
      organization_id: orgId,
      entity_type: "Protocol",
      entity_id: protocol.id,
      event_type: "protocol_created",
      actor_user_id: user.id,
      actor_email: user.email,
      metadata: { source: "import", step_count: editSteps.length, confidence: parsed._confidence },
      created_at: new Date().toISOString(),
    });

    setSaving(false);
    navigate("/protocols");
  }

  const CLASSIFICATIONS = ["Academic Research", "Clinical Diagnostic", "GMP Manufacturing", "ISO Accredited", "CRO Study", "Biotech Startup", "General"];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/protocols")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Protocols
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">Import SOP</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {["Context", "Upload", "Processing", "Review"].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-sm font-medium ${active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {n}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Context */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">What type of protocol are you importing?</h2>
            <p className="text-sm text-muted-foreground mt-1">This helps us parse it correctly.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SECTORS.map(sector => (
              <button key={sector.name} onClick={() => setClassification(sector.name)}
                className={`p-4 rounded-lg border text-left transition-all ${classification === sector.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40"}`}>
                <p className="font-medium text-sm text-foreground">{sector.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sector.desc}</p>
              </button>
            ))}
          </div>
          <Button onClick={() => setStep(2)} disabled={!classification}>
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Step 2 — Upload */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Upload or paste your SOP</h2>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {["upload", "paste"].map(mode => (
              <button key={mode} onClick={() => setInputMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${inputMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {mode === "upload" ? "Upload File" : "Paste Text"}
              </button>
            ))}
          </div>

          {inputMode === "upload" ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
              <input ref={fileRef} type="file" accept=".docx,.txt,.md" className="hidden" onChange={e => setFile(e.target.files[0])} />
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              {file ? (
                <p className="text-sm font-medium text-foreground">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Drop file here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .docx, .txt, .md</p>
                </>
              )}
            </div>
          ) : (
            <Textarea
              placeholder="Paste your protocol text here..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          )}

          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Step granularity</p>
            <div className="flex items-center gap-3">
              {[
                { val: "individual", label: "Individual Steps", desc: "Each bullet = one step" },
                { val: "grouped", label: "Grouped Steps", desc: "Each subsection = one step" },
              ].map(opt => (
                <label key={opt.val} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="granularity" value={opt.val} checked={granularity === opt.val} onChange={() => setGranularity(opt.val)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleProcess} disabled={(inputMode === "upload" && !file) || (inputMode === "paste" && !pasteText.trim())}>
              Process Document
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Processing */}
      {step === 3 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-5" />
          <p className="text-base font-medium text-foreground">Analysing document...</p>
          <p className="text-sm text-muted-foreground mt-1">Parsing sections, steps, and materials.</p>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && parsed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Review & Edit</h2>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[parsed._confidence]}`}>
                {parsed._confidence} confidence
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Metadata */}
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metadata</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Protocol Title</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Description</label>
                    <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="mt-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Classification</label>
                    <select value={editClass} onChange={e => setEditClass(e.target.value)}
                      className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-card text-foreground">
                      {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Est. Duration (min)</label>
                    <Input type="number" value={editDuration} onChange={e => setEditDuration(e.target.value)} className="mt-1" placeholder="e.g. 45" />
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Detected</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>{editSteps.length} steps parsed</p>
                  <p>{editChecklist.length} checklist items</p>
                  <p>{editSections.length} sections</p>
                  {(parsed.compliance_tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {parsed.compliance_tags.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Full editor */}
            <div className="lg:col-span-2 space-y-3">
              {/* Non-execution sections */}
              {editSections.filter(s => s.type !== "procedure").map(sec => {
                const borderClass = SECTION_BORDER[sec.type] || SECTION_BORDER.general;
                if (sec.type === "materials" && sec.subsections?.length > 0) {
                  return (
                    <div key={sec.id} className={`bg-card border border-border rounded-lg p-4 ${borderClass}`}>
                      <h4 className="text-sm font-semibold text-foreground mb-3">{sec.title}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {sec.subsections.map(sub => (
                          <div key={sub.id}>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{sub.title}</p>
                            <ul className="space-y-0.5">
                              {(sub.items || []).map((item, i) => (
                                <li key={i} className="flex items-center gap-1 text-xs text-foreground group">
                                  <span className="flex-1">{item}</span>
                                  {sub.type === "reagents" && (
                                    <button
                                      onClick={() => {
                                        setEditSections(prev => prev.map(s => {
                                          if (s.id !== sec.id) return s;
                                          const newSubs = s.subsections.map(ss => {
                                            if (ss.id === "sub_r") return { ...ss, items: ss.items.filter((_, idx) => idx !== i) };
                                            if (ss.id === "sub_e") return { ...ss, items: [...(ss.items || []), item] };
                                            return ss;
                                          });
                                          return { ...s, subsections: newSubs };
                                        }));
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:underline px-1">
                                      Equip
                                    </button>
                                  )}
                                  {sub.type === "equipment" && (
                                    <button
                                      onClick={() => {
                                        setEditSections(prev => prev.map(s => {
                                          if (s.id !== sec.id) return s;
                                          const newSubs = s.subsections.map(ss => {
                                            if (ss.id === "sub_e") return { ...ss, items: ss.items.filter((_, idx) => idx !== i) };
                                            if (ss.id === "sub_r") return { ...ss, items: [...(ss.items || []), item] };
                                            return ss;
                                          });
                                          return { ...s, subsections: newSubs };
                                        }));
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-xs text-violet-600 hover:underline px-1">
                                      Reagent
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={sec.id} className={`bg-card border border-border rounded-lg p-4 ${borderClass}`}>
                    <h4 className="text-sm font-semibold text-foreground mb-2">{sec.title}</h4>
                    <ul className="space-y-1">
                      {(sec.items || []).map((item, i) => (
                        <li key={i} className="text-sm text-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* Execution steps */}
              <div className="bg-card border-l-4 border-l-purple-400 border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Execution Steps ({editSteps.length})</h4>
                <div className="divide-y divide-border">
                  {editSteps.map((s, idx) => (
                    <StepRow key={s._id || idx} step={s}
                      onDelete={() => setEditSteps(prev => prev.filter((_, i) => i !== idx).map((st, i) => ({ ...st, step_order: i + 1 })))} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !editName.trim()}>
              {saving ? "Saving..." : "Save Protocol"}
            </Button>
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}