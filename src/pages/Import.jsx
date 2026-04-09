import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Upload, FileText, ChevronRight, AlertCircle,
  Beaker, Wrench, Shield, Tag, GripVertical, X, Plus, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

// ── Template downloader ─────────────────────────────────────────────────────
async function downloadSectorTemplate(classification) {
  const TEMPLATES = {
    'Academic Research': [
      { heading: '1. Objective', lines: ['Describe the purpose of this protocol in 1-2 sentences.'], isExecution: false },
      { heading: '2. Materials and Equipment', lines: ['Reagents:', '• [Reagent name — Lot#, Expiry]', '• [Reagent name — Lot#, Expiry]', '', 'Equipment:', '• [Equipment name — Calibration date]', '• [Equipment name]'], isExecution: false },
      { heading: '3. Methods', lines: ['3.1 [First Step Group]', '1. [Step instruction]', '2. [Step instruction]', '3. [Step instruction]', '', '3.2 [Second Step Group]', '1. [Step instruction]', '2. [Step instruction]'], isExecution: true },
      { heading: '4. Data Analysis', lines: ['Describe how results should be analysed and interpreted.'], isExecution: false },
      { heading: '5. References', lines: ['[List any references here]'], isExecution: false }
    ],
    'Clinical Diagnostic': [
      { heading: '1. Purpose', lines: ['Describe the intended use of this test.'], isExecution: false },
      { heading: '2. Specimen Requirements', lines: ['• Sample type: [blood/urine/swab]', '• Volume required: [amount]', '• Storage conditions: [temperature, time]'], isExecution: false },
      { heading: '3. Reagents and Equipment', lines: ['Reagents:', '• [Reagent — Lot#, Expiry]', '', 'Equipment:', '• [Equipment — ID, Calibration due]'], isExecution: false },
      { heading: '4. Test Procedure', lines: ['1. [Step instruction]', '2. [Step instruction]', '3. [Step instruction]', '4. [Step instruction]'], isExecution: true },
      { heading: '5. Quality Control', lines: ['• Positive control: [expected range]', '• Negative control: [expected value]'], isExecution: false },
      { heading: '6. Result Interpretation', lines: ['[Criteria for positive/negative/invalid results]'], isExecution: false }
    ],
    'GMP Manufacturing': [
      { heading: '1. Scope', lines: ['Define what this SOP covers.'], isExecution: false },
      { heading: '2. Responsibilities', lines: ['• [Role]: [Responsibility]', '• [Role]: [Responsibility]'], isExecution: false },
      { heading: '3. Materials and Equipment', lines: ['Materials:', '• [Material — Lot#, Quantity]', '', 'Equipment:', '• [Equipment ID — Calibration date]'], isExecution: false },
      { heading: '4. Safety Considerations', lines: ['• [PPE required]', '• [Hazards and precautions]'], isExecution: false },
      { heading: '5. Manufacturing Instructions', lines: ['5.1 [Phase 1]', '1. [Step instruction]', '2. [Step instruction]', '', '5.2 [Phase 2]', '1. [Step instruction]', '2. [Step instruction]'], isExecution: true },
      { heading: '6. In-Process Controls', lines: ['• [Parameter]: [Acceptable range]'], isExecution: false },
      { heading: '7. Documentation', lines: ['[Records to complete and retention period]'], isExecution: false }
    ],
    'ISO Accredited': [
      { heading: '1. Scope', lines: ['Define the scope and applicable range of this method.'], isExecution: false },
      { heading: '2. Equipment and Materials', lines: ['Equipment:', '• [Equipment — Model, Calibration due]', '', 'Standards/Reagents:', '• [Standard — Lot#, Traceability certificate]'], isExecution: false },
      { heading: '3. Test Method', lines: ['3.1 Sample Preparation', '1. [Step instruction]', '2. [Step instruction]', '', '3.2 Measurement Procedure', '1. [Step instruction]', '2. [Step instruction]'], isExecution: true },
      { heading: '4. Measurement Uncertainty', lines: ['[Uncertainty components and combined uncertainty value]'], isExecution: false },
      { heading: '5. Records Retention', lines: ['[Records required and retention period]'], isExecution: false }
    ],
    'CRO Study': [
      { heading: '1. Objective', lines: ['State the primary and secondary objectives.'], isExecution: false },
      { heading: '2. Study Design', lines: ['• Study type: [in vitro/in vivo/clinical]', '• Replicates: n=[X]', '• Controls: [types]'], isExecution: false },
      { heading: '3. Materials', lines: ['Test Articles:', '• [Compound — Lot#, Purity]', '', 'Equipment:', '• [Equipment — ID]'], isExecution: false },
      { heading: '4. Study Procedure', lines: ['4.1 Sample Preparation', '1. [Step instruction]', '2. [Step instruction]', '', '4.2 Assay Execution', '1. [Step instruction]', '2. [Step instruction]'], isExecution: true },
      { heading: '5. Deliverables', lines: ['• [Report type — timeline]', '• [Data package — format]'], isExecution: false }
    ],
    'Biotech Startup': [
      { heading: 'Objective', lines: ['What this protocol achieves in 1-2 sentences.'], isExecution: false },
      { heading: 'Materials', lines: ['Reagents:', '• [Reagent]', '• [Reagent]', '', 'Equipment:', '• [Equipment]'], isExecution: false },
      { heading: 'Steps', lines: ['1. [Step instruction]', '2. [Step instruction]', '3. [Step instruction]', '4. [Step instruction]'], isExecution: true },
      { heading: 'Expected Results', lines: ['[What success looks like]'], isExecution: false },
      { heading: 'Troubleshooting', lines: ['• Problem: [issue] → Solution: [fix]'], isExecution: false }
    ],
    'General': [
      { heading: '1. Purpose', lines: ['What this protocol achieves.'], isExecution: false },
      { heading: '2. Materials', lines: ['Reagents:', '• [Item]', '', 'Equipment:', '• [Item]'], isExecution: false },
      { heading: '3. Procedure', lines: ['1. [Step instruction]', '2. [Step instruction]', '3. [Step instruction]'], isExecution: true },
      { heading: '4. Notes', lines: ['[Additional information]'], isExecution: false }
    ]
  };

  const sections = TEMPLATES[classification] || TEMPLATES['General'];
  const escXml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let body = '';
  body += `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>[Protocol Title]</w:t></w:r></w:p>`;
  body += `<w:p><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr><w:t>Classification: ${escXml(classification)} | BenchTrace 4.0 Template</w:t></w:r></w:p>`;
  body += `<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`;

  for (const section of sections) {
    body += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escXml(section.heading)}</w:t></w:r></w:p>`;
    if (section.isExecution) {
      body += `<w:p><w:r><w:rPr><w:color w:val="4F46E5"/><w:i/><w:sz w:val="18"/></w:rPr><w:t>BenchTrace extracts execution steps from this section. Use numbered subsections (3.1, 3.2) with bullet points for best results.</w:t></w:r></w:p>`;
      body += `<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`;
    }
    for (const line of section.lines) {
      body += `<w:p><w:r><w:t xml:space="preserve">${escXml(line)}</w:t></w:r></w:p>`;
    }
    body += `<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/><w:color w:val="1E293B"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="1E293B"/></w:rPr></w:style></w:styles>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const enc = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(relsXml) },
    { name: 'word/document.xml', data: enc.encode(documentXml) },
    { name: 'word/styles.xml', data: enc.encode(stylesXml) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(wordRelsXml) },
  ];

  const crc32 = (buf) => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); table[i] = c; }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  const u16 = (n) => [n & 0xFF, (n >> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF];

  const localHeaders = [], centralDir = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array([0x50,0x4B,0x03,0x04,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32(crc),...u32(size),...u32(size),...u16(nameBytes.length),0x00,0x00,...nameBytes]);
    localHeaders.push({ header: localHeader, data: file.data });
    const centralEntry = new Uint8Array([0x50,0x4B,0x01,0x02,0x14,0x00,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32(crc),...u32(size),...u32(size),...u16(nameBytes.length),0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32(offset),...nameBytes]);
    centralDir.push(centralEntry);
    offset += localHeader.length + file.data.length;
  }
  const centralSize = centralDir.reduce((s, e) => s + e.length, 0);
  const eocd = new Uint8Array([0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00,...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),0x00,0x00]);
  const totalSize = localHeaders.reduce((s, f) => s + f.header.length + f.data.length, 0) + centralDir.reduce((s, e) => s + e.length, 0) + eocd.length;
  const zip = new Uint8Array(totalSize);
  let pos = 0;
  for (const f of localHeaders) { zip.set(f.header, pos); pos += f.header.length; zip.set(f.data, pos); pos += f.data.length; }
  for (const e of centralDir) { zip.set(e, pos); pos += e.length; }
  zip.set(eocd, pos);

  const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BenchTrace_${(classification || 'General').replace(/[\s\/]+/g, '_')}_Template.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

// ── Confidence Gate Screen ──────────────────────────────────────────────────
function ConfidenceGateScreen({ parsed, classification, onContinue, onDownloadTemplate, onReUpload, onTryAI }) {
  const hasExecutionSection = !!parsed._detected_section;
  const hasSteps = parsed.steps && parsed.steps.length > 0;
  const hasMaterials = parsed.sections_json?.some(s => s.type === 'materials');
  const hasPurpose = parsed.sections_json?.some(s => s.type === 'purpose');
  const stepCount = parsed.steps?.length || 0;

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '20px 24px', marginBottom: 20, borderTop: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>Low Parse Confidence</div>
              <div style={{ fontSize: 12, color: '#ef4444' }}>We had difficulty extracting structured steps from your document</div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>What the parser found:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {[
              { label: 'Numbered execution section (3.1, 3.2...)', found: hasExecutionSection },
              { label: `Execution steps (${stepCount} found)`, found: hasSteps && stepCount > 2 },
              { label: 'Materials / Reagents section', found: hasMaterials },
              { label: 'Purpose / Objective section', found: hasPurpose },
            ].map((check, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: check.found ? '#16a34a' : '#ef4444', flexShrink: 0 }}>{check.found ? '✓' : '✗'}</span>
                <span style={{ fontSize: 12, color: check.found ? '#374151' : '#94a3b8' }}>{check.label}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', background: 'white', borderRadius: 7, border: '1px solid #fecaca', fontSize: 12, color: '#7f1d1d' }}>
            <strong>Why this matters:</strong> Poor step detection means you'll need to manually add or edit most execution steps after import — which defeats the purpose of importing.
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14, textAlign: 'center' }}>We recommend one of these options:</div>

        <div style={{ background: 'white', border: '2px solid #6366f1', borderRadius: 12, padding: '20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: '#6366f1', color: 'white' }}>RECOMMENDED</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>📄 Use the BenchTrace Template</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
            Download our <strong>{classification}</strong> template, copy your protocol content into it, and re-upload. The template is pre-structured for perfect parsing — you'll get clean steps with zero editing.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDownloadTemplate} style={{ flex: 1, padding: '10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ↓ Download {classification} Template
            </button>
            <button onClick={onReUpload} style={{ padding: '10px 16px', background: 'white', color: '#6366f1', border: '1px solid #c7d2fe', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Re-upload
            </button>
          </div>
        </div>

        <div style={{ background: '#eef2ff', border: '2px solid #6366f1', borderRadius: 12, padding: '20px', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#4338ca', marginBottom: 6 }}>✨ Try AI Parse Instead</div>
          <div style={{ fontSize: 12, color: '#4338ca', lineHeight: 1.6, marginBottom: 14, opacity: 0.85 }}>
            AI can read complex SOPs even with non-standard formatting. It works well where the smart parser struggles — prose sections, unusual numbering, or missing section headers.
          </div>
          <button onClick={() => onTryAI && onTryAI()} style={{ width: '100%', padding: '10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ✨ Switch to AI Parse →
          </button>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 6 }}>⚡ Continue Anyway</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
            Proceed to the review screen with what was detected.
            {stepCount > 0
              ? ` We found ${stepCount} step${stepCount !== 1 ? 's' : ''} — you can add, edit, and rearrange them manually.`
              : " You'll need to add all execution steps manually in the protocol editor."
            }
            {' '}This may take significantly more time than using the template.
          </div>
          <button onClick={onContinue} style={{ width: '100%', padding: '9px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            Continue with {stepCount} step{stepCount !== 1 ? 's' : ''} →
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          💡 Labs using our templates save an average of 15 minutes per protocol import
        </div>
      </div>
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
  const [showConfidenceGate, setShowConfidenceGate] = useState(false);
  const [gateChoice, setGateChoice] = useState(null);
  const [useAI, setUseAI] = useState(false);
  const [stepGranularity, setStepGranularity] = useState('individual');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showParserGuide, setShowParserGuide] = useState(false);
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

  const handleAIParse = async (text) => {
    setAiParsing(true);
    setAiError('');
    const granularityInstruction = stepGranularity === 'individual'
      ? `IMPORTANT: Extract each bullet point or action as a SEPARATE individual step. Do NOT group multiple bullets under one step. If a subsection like "6.1 RNA Quality Assessment" has 3 bullet points → create 3 separate steps. Each bullet becomes its own step. The step title = subsection name (max 60 chars). The step instruction = the bullet text only (never repeat the title in the instruction). Total steps should equal total number of bullet points/actions.`
      : `Extract subsections as grouped steps. Each subsection (e.g. "6.1 RNA Quality Assessment") becomes ONE step, with all its bullet points combined into the instruction text. Step title = subsection name. Instruction = all bullets joined.`;
    const prompt = `You are a laboratory SOP parser. Extract structured protocol data from the document below.

${granularityInstruction}

Return ONLY valid JSON — no markdown, no backticks, no explanation. Just the raw JSON object:
{
  "name": "specific protocol name — never use generic titles like Standard Operating Procedure",
  "description": "1-2 sentence plain text summary of what this protocol does",
  "classification": "one of: Academic Research, Clinical Diagnostic, GMP Manufacturing, ISO Accredited, CRO Study, Biotech Startup, General",
  "estimated_duration_minutes": number or null,
  "compliance_tags": ["array of detected standards e.g. GMP, ISO, CLIA, 21 CFR Part 11, GLP"],
  "steps": [
    {
      "step_order": 1,
      "title": "subsection or group name — max 60 chars",
      "instruction": "action text only — NEVER copy or repeat the title here",
      "is_critical": false,
      "estimated_duration_seconds": null,
      "requires_measurement": false
    }
  ],
  "checklist_items": [
    {
      "item_text": "material or equipment name",
      "category": "reagent or equipment or safety or other"
    }
  ]
}

Rules:
- step title and instruction must NEVER be identical or duplicate each other
- instruction = the action text only, not a copy of the title
- is_critical = true if the text contains: critical, warning, caution, must not, do not, danger, immediately
- Convert time mentions to seconds (5 minutes = 300, 1 hour = 3600, 30 seconds = 30)
- requires_measurement = true if step involves measuring, recording, calculating a value
- Extract ALL materials and equipment as checklist_items with correct categories
- compliance_tags: detect GMP, GLP, ISO, CLIA, FDA, 21 CFR Part 11 from context

Document:
${text.substring(0, 10000)}`;
    try {
      const responseText = await base44.integrations.Core.InvokeLLM({ prompt });
      const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const aiResult = JSON.parse(cleaned);
      if (!aiResult.steps || !Array.isArray(aiResult.steps)) throw new Error('AI did not return a valid steps array');
      const normalisedSteps = aiResult.steps.map((s, i) => ({
        ...s,
        step_order: s.step_order || i + 1,
        _id: `ai_s_${i}`,
        title: (s.title || '').substring(0, 200),
        instruction: s.instruction || s.title || '',
        is_critical: s.is_critical || false,
        estimated_duration_seconds: s.estimated_duration_seconds || null,
        requires_measurement: s.requires_measurement || false,
      }));
      const checklistItems = (aiResult.checklist_items || []).map((item, i) => ({
        ...item,
        _id: `ai_c_${i}`,
        category: ['reagent', 'equipment', 'safety', 'other'].includes(item.category) ? item.category : 'other',
      }));
      const result = {
        name: aiResult.name || 'Imported Protocol',
        description: aiResult.description || '',
        classification: aiResult.classification || classification || 'General',
        estimated_duration_minutes: aiResult.estimated_duration_minutes || null,
        compliance_tags: aiResult.compliance_tags || [],
        steps: normalisedSteps,
        checklist_items: checklistItems,
        structured_materials: null,
        _confidence: 'high',
        _detected_section: `AI Parsed (${stepGranularity === 'individual' ? 'individual steps' : 'grouped steps'})`,
        _parser_mode: 'ai',
      };
      setParsed(result);
      setEditName(result.name);
      setEditDesc(result.description);
      setEditClass(result.classification);
      setEditDuration(result.estimated_duration_minutes ? String(result.estimated_duration_minutes) : '');
      setEditSections([]);
      setEditSteps(result.steps);
      setEditChecklist(result.checklist_items);
      setStep(4);
    } catch (e) {
      console.error('AI parse failed:', e);
      setAiError(e.message?.includes('JSON')
        ? 'AI returned an unexpected format. Try again or use the smart parser.'
        : `AI parsing failed: ${e.message || 'Unknown error'}. Please try again.`);
    } finally {
      setAiParsing(false);
    }
  };

  async function handleProcess() {
    if (inputMode === "upload" && !file) return;
    if (inputMode === "paste" && !pasteText.trim()) return;

    setProcessing(true);
    setStep(3);
    setError("");
    setAiError("");

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

    if (useAI) {
      setProcessing(false);
      await handleAIParse(text);
    } else {
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
      if (result._confidence === 'low') {
        setShowConfidenceGate(true);
      } else {
        setShowConfidenceGate(false);
        setStep(4);
      }
    }
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
      metadata: { source: 'import', step_count: editSteps.length, confidence: parsed._confidence, detected_section: parsed._detected_section, parser_mode: parsed._parser_mode || 'smart', step_granularity: parsed._parser_mode === 'ai' ? stepGranularity : null },
      created_at: new Date().toISOString(),
    });

    setSaving(false);
    navigate("/protocols");
  }

  const CLASSIFICATIONS = ["Academic Research", "Clinical Diagnostic", "GMP Manufacturing", "ISO Accredited", "CRO Study", "Biotech Startup", "General"];

  if (showConfidenceGate && parsed) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/protocols")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Protocols
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">Import SOP</span>
        </div>
        <ConfidenceGateScreen
          parsed={parsed}
          classification={classification}
          onContinue={() => { setShowConfidenceGate(false); setGateChoice('continue'); setStep(4); }}
          onDownloadTemplate={() => downloadSectorTemplate(classification)}
          onReUpload={() => { setShowConfidenceGate(false); setGateChoice(null); setParsed(null); setStep(2); }}
          onTryAI={() => { setShowConfidenceGate(false); setUseAI(true); setGateChoice(null); setParsed(null); setStep(2); }}
        />
      </div>
    );
  }

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
          {classification && (
            <div style={{ marginTop: 20, padding: '14px 18px', background: '#f0f4ff', borderRadius: 10, border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca', marginBottom: 3 }}>Download {classification} Template</div>
                <div style={{ fontSize: 12, color: '#6366f1' }}>Pre-structured .docx — optimised for BenchTrace parser. Fill it in and upload for best results.</div>
              </div>
              <button onClick={() => downloadSectorTemplate(classification)} style={{ padding: '8px 18px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>↓ Download Template</button>
            </div>
          )}
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

          {/* Parser guide */}
          <div style={{ marginBottom: 0 }}>
            <button onClick={() => setShowParserGuide(prev => !prev)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: showParserGuide ? '8px 8px 0 0' : 8, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#475569', fontWeight: 600 }}>
              <span style={{ fontSize: 15 }}>ℹ</span>
              <span>How BenchTrace detects your steps</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{showParserGuide ? '▲ hide' : '▼ show'}</span>
            </button>
            {showParserGuide && (
              <div style={{ padding: '16px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { icon: '📋', title: 'Numbered subsections → step group titles', example: '3.1 RNA Quality Assessment, 3.2 Reverse Transcription...', detail: 'Each numbered subsection becomes a step group label shown in the execution screen' },
                    { icon: '•', title: 'Bullet points under subsections → individual steps', example: '• Measure RNA concentration\n• Assess RNA integrity', detail: 'Each bullet becomes one executable step. Use "Individual Steps" mode for this.' },
                    { icon: '⏱', title: 'Time mentions → advisory timer auto-set', example: '"Incubate for 5 minutes", "centrifuge for 30 sec"', detail: 'Duration is extracted and set as an advisory countdown timer on that step' },
                    { icon: '⚠', title: '"critical", "warning", "do not" → step flagged critical', example: '"Do not exceed 42°C", "Critical: maintain cold chain"', detail: 'Step is highlighted in red and operators are alerted during execution' },
                    { icon: '🧪', title: 'Materials section → pre-run checklist', example: 'Reagents: RNA kit, SYBR Green...\nEquipment: Centrifuge, qPCR...', detail: 'Reagents and equipment are captured as checklist items with lot number and expiry fields' },
                    { icon: '📄', title: 'Tip: use our template for best results', example: `Download the ${classification || 'sector'} template from Step 1`, detail: 'Templates are pre-structured with the exact section headers our parser expects' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: 'center', marginTop: 1 }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', background: '#eef2ff', padding: '2px 7px', borderRadius: 4, marginBottom: 3, whiteSpace: 'pre-line' }}>{item.example}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

          {/* AI Parser Controls */}
          <div style={{ marginTop: 16, padding: '14px 16px', background: useAI ? '#eef2ff' : '#f8fafc', border: `1px solid ${useAI ? '#c7d2fe' : '#e2e8f0'}`, borderRadius: 10, transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useAI ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>✨</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    AI Parse
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#6366f1', color: 'white' }}>RECOMMENDED</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {useAI ? 'AI will read and extract your protocol intelligently' : 'Use AI for complex SOPs or when smart parser returns few steps'}
                  </div>
                </div>
              </div>
              <div onClick={() => setUseAI(prev => !prev)} style={{ width: 44, height: 24, borderRadius: 99, cursor: 'pointer', background: useAI ? '#6366f1' : '#cbd5e1', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: useAI ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
            </div>
            {useAI && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Step Granularity</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'individual', icon: '◉', label: 'Individual Steps', desc: 'Each bullet point = one step — best for detailed execution tracking' },
                    { value: 'grouped', icon: '⊞', label: 'Grouped Steps', desc: 'Each subsection = one step — best for complex multi-part procedures' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setStepGranularity(opt.value)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, textAlign: 'left', border: `2px solid ${stepGranularity === opt.value ? '#6366f1' : '#e2e8f0'}`, background: stepGranularity === opt.value ? '#eef2ff' : 'white', color: stepGranularity === opt.value ? '#4338ca' : '#64748b', transition: 'all 0.15s' }}>
                      <div style={{ fontWeight: 700, marginBottom: 3 }}>{opt.icon} {opt.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.4 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, fontSize: 11, color: '#4338ca' }}>
                  💡 AI Parse reads your full document context — it works well even with non-standard formatting, continuous prose, and unusual section names.
                </div>
              </div>
            )}
          </div>

          {aiParsing && (
            <div style={{ marginTop: 12, padding: '14px 16px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #c7d2fe', borderTop: '2px solid #6366f1', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca' }}>AI is reading your protocol...</div>
                <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>Extracting steps, materials, and compliance tags</div>
              </div>
            </div>
          )}

          {aiError && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
              ⚠ {aiError}
              <button onClick={() => setAiError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Dismiss</button>
            </div>
          )}

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleProcess} disabled={(inputMode === "upload" && !file) || (inputMode === "paste" && !pasteText.trim())}>
              {useAI ? 'Parse with AI' : 'Process Document'}
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
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <h2 className="text-base font-semibold text-foreground">Review & Edit</h2>
          </div>

          {/* AI parse badge */}
          {parsed?._parser_mode === 'ai' && (
            <div style={{ padding: '10px 14px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca' }}>AI Parsed — {parsed._detected_section}</div>
                <div style={{ fontSize: 11, color: '#6366f1' }}>{parsed.steps?.length} steps extracted · High confidence · Review before saving</div>
              </div>
            </div>
          )}

          {/* Medium confidence warning — non-blocking amber banner */}
          {parsed._confidence === 'medium' && gateChoice !== 'continue' && (
            <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 4, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Medium confidence — review carefully</div>
                <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                  Some steps may be incomplete or incorrectly grouped. Check each step below before saving.
                  For future imports, <button onClick={() => downloadSectorTemplate(classification)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'underline', padding: 0 }}>download our {classification} template</button> for better results.
                </div>
              </div>
            </div>
          )}

          {/* Low confidence warning — shown when user chose Continue Anyway */}
          {gateChoice === 'continue' && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 4, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>🔴</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 3 }}>Low confidence import — manual review required</div>
                <div style={{ fontSize: 12, color: '#b91c1c', lineHeight: 1.6 }}>
                  Most steps will need manual editing. Review each step carefully and add any missing steps before saving. Consider using our <button onClick={() => downloadSectorTemplate(classification)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'underline', padding: 0 }}>{classification} template</button> for future imports.
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: parsed._confidence === 'high' ? '#f0fdf4' : parsed._confidence === 'medium' ? '#fffbeb' : '#fef2f2', color: parsed._confidence === 'high' ? '#16a34a' : parsed._confidence === 'medium' ? '#d97706' : '#dc2626', border: `1px solid ${parsed._confidence === 'high' ? '#bbf7d0' : parsed._confidence === 'medium' ? '#fde68a' : '#fecaca'}` }}>
                {parsed._confidence === 'high' ? '✓ High confidence' : parsed._confidence === 'medium' ? '⚠ Medium confidence' : '⚠ Low confidence'}
              </span>
              {parsed._detected_section && (
                <span style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: 99 }}>Execution section: "{parsed._detected_section}"</span>
              )}
            </div>
            {parsed._confidence !== 'high' && (
              <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Parser feedback — please review carefully:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    { label: 'Execution section found', found: !!parsed._detected_section || (parsed.steps && parsed.steps.length > 0) },
                    { label: 'Numbered subsections (3.1, 3.2...)', found: parsed.steps?.some(s => s.title) },
                    { label: 'Materials / Reagents section', found: parsed.sections_json?.some(s => s.type === 'materials') },
                    { label: 'Purpose / Objective section', found: parsed.sections_json?.some(s => s.type === 'purpose') },
                  ].map((check, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: check.found ? '#16a34a' : '#ef4444' }}>{check.found ? '✓' : '✗'}</span>
                      <span style={{ fontSize: 12, color: check.found ? '#374151' : '#6b7280' }}>{check.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
                  <strong>Tip:</strong> For best results, download and use the <strong>{classification}</strong> template from Step 1.
                  It's pre-structured with the exact section headers BenchTrace expects.
                  <button onClick={() => setStep(1)} style={{ marginLeft: 8, fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>← Go back to download template</button>
                </div>
              </div>
            )}
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