import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePlan } from "@/lib/PlanContext";
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
  // Mobile-safe array buffer reading — tries arrayBuffer() first, falls back to FileReader
  const readAsArrayBuffer = (f) => new Promise((resolve, reject) => {
    if (f.arrayBuffer) {
      f.arrayBuffer()
        .then(resolve)
        .catch(() => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = () => reject(new Error('FileReader failed to read the file'));
          reader.readAsArrayBuffer(f);
        });
    } else {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('FileReader failed to read the file'));
      reader.readAsArrayBuffer(f);
    }
  });

  const waitForJSZip = () => new Promise((resolve, reject) => {
    if (window.JSZip) { resolve(); return; }
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (window.JSZip) { clearInterval(check); resolve(); }
      if (attempts > 20) {
        clearInterval(check);
        reject(new Error('JSZip library failed to load. Please check your connection and try again.'));
      }
    }, 200);
  });

  try {
    await waitForJSZip();
  } catch(e) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load file parser. Please use "Paste Text" option instead.'));
      document.head.appendChild(script);
    });
  }

  const arrayBuffer = await readAsArrayBuffer(file);
  const zip = await window.JSZip.loadAsync(arrayBuffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Invalid DOCX file structure. Please ensure this is a valid Word document.');

  const xml = await xmlFile.async('string');
  const text = xml
    .replace(/<w:br[^>]*\/>/gi, '\n').replace(/<w:p[^>]*>/gi, '\n')
    .replace(/<\/w:p>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x2013;/g, '–').replace(/&#x2014;/g, '—')
    .replace(/&#x2019;/g, "'").replace(/&#xD;/g, '');

  if (!text || text.trim().length < 20) throw new Error('Document appears empty or could not be read.');
  return text;
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

function renderStepInstruction(instruction) {
  const text = instruction || '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const hasBullets = lines.length > 1 && lines.some(l => l.startsWith('•') || l.startsWith('-'));
  if (hasBullets) {
    return (
      <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
        {lines.map((line, i) => {
          const clean = line.replace(/^[•\-\*]\s*/, '').trim();
          if (!clean) return null;
          return (
            <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
              <span style={{ color: '#6366f1', flexShrink: 0, fontSize: 14, lineHeight: '1.4' }}>•</span>
              <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{clean}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  return <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{text}</div>;
}

// ── Step row in review ────────────────────────────────────────────────────────
function StepRow({ step, onDelete }) {
  const isGrouped = !!(step.title && step.instruction && (step.instruction.includes('•') || step.instruction.includes('\n')) && step.instruction.length > 80);
  return (
    <div className="flex items-start gap-2 py-2 group">
      <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
        {step.step_order}
      </span>
      <div className="flex-1 min-w-0">
        {step.title && step.title !== step.instruction && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isGrouped && (
              <span style={{ padding: '1px 6px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4, fontSize: 9 }}>GROUP</span>
            )}
            {step.title}
          </div>
        )}
        {renderStepInstruction(step.instruction)}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {step.is_critical && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>🔴 CRITICAL</span>
          )}
          {step.timing_mode === 'strict' && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              ⏱ STRICT {step.expected_duration_seconds ? `${Math.round(step.expected_duration_seconds / 60)}min` : ''}
            </span>
          )}
          {step.timing_mode === 'advisory' && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
              ⏱ ADVISORY {step.expected_duration_seconds ? `${step.expected_duration_seconds >= 60 ? Math.round(step.expected_duration_seconds / 60) + 'min' : step.expected_duration_seconds + 's'}` : ''}
            </span>
          )}
          {step.requires_measurement && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>📏 MEASURE</span>
          )}
        </div>
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Sector-aware AI prompts ─────────────────────────────────────────────────
const SECTOR_AI_PROMPTS = {
  'Academic Research': {
    context: `This is an academic research protocol used in university or research institute labs. 
Focus on: experimental steps, incubation times, centrifugation, PCR, gel electrophoresis, spectrophotometry.
Timing: Use 'advisory' timer mode for incubations and reactions (researcher controls when to start).
Critical steps: DNA/RNA handling, contamination prevention, temperature-sensitive steps.
Measurements: absorbance (A260/A280), Ct values, band sizes, concentrations (µg/mL, ng/µL).
Materials: reagents (enzymes, buffers, primers), equipment (thermocycler, centrifuge, gel apparatus).`,
    examples: `Example step with timer: "Incubate at 65°C for 5 minutes" → timing_mode: "advisory", expected_duration_seconds: 300
Example measurement: "Measure A260/A280 ratio" → requires_measurement: true, measurement_parameters: [{name: "A260/A280 ratio", unit: "ratio", min_value: 1.8, max_value: 2.1, required: true}]
Example critical: "Do not vortex RNA" → is_critical: true`,
  },
  'GMP Manufacturing': {
    context: `This is a GMP manufacturing protocol for pharmaceutical or biotech production.
Focus on: batch manufacturing steps, critical control points, in-process testing, cleaning procedures.
Timing: Use 'strict' timer mode with tolerance windows for time-critical manufacturing steps.
Critical steps: ANY step mentioning "critical", "CCP", "must", "do not", mixing, sterilisation.
Measurements: pH, temperature, yield %, purity %, osmolality, bioburden, endotoxin.
Tolerance: Manufacturing steps typically allow ±10% time tolerance.
Materials: raw materials (APIs, excipients), equipment (bioreactors, filtration, filling).`,
    examples: `Example strict step: "Mix for exactly 30 minutes ± 5 minutes" → timing_mode: "strict", expected_duration_seconds: 1800, tolerance_lower_seconds: 300, tolerance_upper_seconds: 300
Example measurement: "Check pH 7.2 ± 0.1" → requires_measurement: true, measurement_parameters: [{name: "pH", unit: "pH units", min_value: 7.1, max_value: 7.3, required: true}]`,
  },
  'Clinical Diagnostic': {
    context: `This is a clinical diagnostic protocol used in hospital or diagnostic laboratory settings.
Focus on: sample preparation, assay procedure, QC checks, result interpretation, reporting.
Timing: Use 'strict' timer mode for incubations — clinical results depend on precise timing.
Critical steps: QC failures, sample identification, reagent expiry checks, contamination prevention.
Measurements: absorbance, concentration, positive/negative thresholds, reference ranges.
Materials: clinical reagents (assay kits, controls, calibrators), diagnostic instruments.`,
    examples: `Example clinical timer: "Incubate samples for exactly 30 minutes at 37°C" → timing_mode: "strict", expected_duration_seconds: 1800, tolerance_lower_seconds: 60, tolerance_upper_seconds: 60
Example QC measurement: "Read absorbance at 450nm" → requires_measurement: true, measurement_parameters: [{name: "Absorbance", unit: "OD (450nm)", min_value: 0, max_value: 3, required: true}]`,
  },
  'ISO Accredited': {
    context: `This is an ISO-accredited laboratory protocol requiring full measurement traceability.
Focus on: measurement procedures, calibration steps, uncertainty estimation, QC checks.
Timing: Use 'strict' timer mode for all timed steps — ISO requires precise timing documentation.
Critical steps: calibration, reference standard handling, environmental conditions, sample integrity.
Measurements: every measurement step requires defined units, ranges, and acceptance criteria.
Materials: certified reference materials, calibrated equipment, accredited reagents.`,
    examples: `Example ISO measurement: "Weigh sample to nearest 0.1mg" → requires_measurement: true, measurement_parameters: [{name: "Sample mass", unit: "mg", min_value: null, max_value: null, required: true}]`,
  },
  'CRO Study': {
    context: `This is a CRO (Contract Research Organisation) study protocol following GCP/GLP guidelines.
Focus on: study conduct procedures, sample collection, data recording, audit trail requirements.
Timing: Use 'advisory' timer mode for most steps, 'strict' for pharmacokinetic sampling timepoints.
Critical steps: timepoint collection, randomisation, blinding procedures, chain of custody.
Measurements: vital signs, lab values, pharmacokinetic parameters, safety assessments.
Materials: study drugs, study supplies, clinical equipment, sample collection kits.`,
    examples: `Example PK timepoint: "Collect blood sample at exactly 2 hours post-dose ± 5 minutes" → timing_mode: "strict", expected_duration_seconds: 7200, tolerance_lower_seconds: 300, tolerance_upper_seconds: 300`,
  },
  'Biotech Startup': {
    context: `This is a biotech startup protocol — likely a mix of research and early manufacturing.
Focus on: cell culture, protein expression, purification, analytical characterisation.
Timing: Use 'advisory' for research steps, 'strict' for fermentation and purification steps.
Critical steps: sterility, cell viability, protein integrity, buffer preparation accuracy.
Measurements: OD600 (cell density), protein concentration, purity %, binding affinity.
Materials: cell lines, growth media, chromatography resins, analytical reagents.`,
    examples: `Example cell culture timer: "Incubate cells for 24 hours" → timing_mode: "advisory", expected_duration_seconds: 86400`,
  },
  'General': {
    context: `This is a general laboratory protocol. Extract all steps faithfully from the document.
Timing: Use 'advisory' for informational timers, 'strict' for precise time-critical steps.
Critical steps: any step with warnings, safety notices, or "must" language.
Measurements: any step requiring recording a numeric value.
Materials: any reagents, chemicals, equipment, or consumables listed.`,
    examples: `Example: "Heat to 95°C for 5 minutes" → timing_mode: "advisory", expected_duration_seconds: 300`,
  },
};

function validateAIProtocolOutput(result) {
  const errors = [];
  const warnings = [];
  if (!result) { errors.push('AI returned no data'); return { errors, warnings }; }
  if (!result.name || result.name.trim().length < 2) warnings.push('Protocol name is very short');
  if (!result.steps || !Array.isArray(result.steps)) { errors.push('No steps array returned'); return { errors, warnings }; }
  if (result.steps.length === 0) { errors.push('Zero steps extracted'); return { errors, warnings }; }
  result.steps.forEach((s, i) => {
    if (!s.instruction || s.instruction.trim().length < 3) errors.push(`Step ${i + 1} has no instruction`);
    if (s.title && s.title.trim() === s.instruction?.trim()) warnings.push(`Step ${i + 1} title duplicates instruction`);
    if (s.expected_duration_seconds < 0) errors.push(`Step ${i + 1} has negative duration`);
    if (s.timing_mode && !['none', 'advisory', 'strict'].includes(s.timing_mode)) errors.push(`Step ${i + 1} has invalid timing_mode: ${s.timing_mode}`);
    if (s.tolerance_lower_seconds < 0 || s.tolerance_upper_seconds < 0) warnings.push(`Step ${i + 1} has negative tolerance`);
  });
  return { errors, warnings };
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

        {/* BEST OPTION — Try AI first */}
        <div style={{ background: 'linear-gradient(135deg, #eef2ff, #f0f9ff)', border: '2px solid #6366f1', borderRadius: 12, padding: '20px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>BEST OPTION</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>✨ Try AI Normaliser</div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, marginBottom: 14 }}>
            AI reads your document intelligently — it understands context, not just formatting. Works even when the smart parser struggles with unusual layouts or prose-style protocols.
          </div>
          <button onClick={() => { if (onTryAI) onTryAI(); }}
            style={{ width: '100%', padding: '10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ✨ Switch to AI Normaliser →
          </button>
        </div>

        <div style={{ background: 'white', border: '2px solid #6366f1',
          borderRadius: 12, padding: '20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: '#6366f1', color: 'white' }}>USE TEMPLATE</span>
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
function useDeviceType() {
  const [device, setDevice] = useState(() => { const w = window.innerWidth; return { isMobile: w < 768 }; });
  useEffect(() => {
    const update = () => { const w = window.innerWidth; setDevice({ isMobile: w < 768 }); };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return device;
}

export default function Import() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const device = useDeviceType();
  const orgId = localStorage.getItem("bt_org_id");
  const { canAccess, isBeta, switchPreviewPlan } = usePlan();

  const [step, setStep] = useState(1);
  const [classification, setClassification] = useState("");
  const [uploadSubState, setUploadSubState] = useState('idle'); // 'idle' | 'selected' | 'processing'
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedParserMode, setSelectedParserMode] = useState('smart'); // 'ai' | 'smart' — updated after org loads
  const [showConfidenceGate, setShowConfidenceGate] = useState(false);
  const [gateChoice, setGateChoice] = useState(null);
  const [useAI, setUseAI] = useState(false);
  // stepGranularity removed — always individual (one bullet = one step)
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showParserGuide, setShowParserGuide] = useState(false);
  const [inputMode, setInputMode] = useState(window.innerWidth < 768 ? 'paste' : 'upload');
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [granularity, setGranularity] = useState("individual");
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Review state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editSections, setEditSections] = useState([]);
  const [editSteps, setEditSteps] = useState([]);
  const [editChecklist, setEditChecklist] = useState([]);

  // Set default parser mode once we know the plan
  useEffect(() => {
    if (canAccess('ai_normaliser')) setSelectedParserMode('ai');
    else setSelectedParserMode('smart');
  }, [canAccess]);

  // Pre-load JSZip on mount for mobile reliability
  useEffect(() => {
    if (window.JSZip) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async = true;
    script.onload = () => { console.log('JSZip pre-loaded successfully'); };
    script.onerror = () => { console.warn('JSZip CDN failed — will use text fallback'); };
    document.head.appendChild(script);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  const handleProcessFile = async (file) => {
    setUploadError('');
    try {
      setUploadSubState('processing');
      setAiError('');
      let text = '';
      const fileName = (file.name || '').toLowerCase();

      try {
        if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
          text = await extractDocxText(file);
        } else if (fileName.endsWith('.pdf')) {
          const rawText = await file.text();
          text = rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{4,}/g, '\n').trim();
          if (text.split(/\s+/).filter(w => w.length > 2).length < 20) {
            throw new Error('This PDF appears to be scanned or image-based. Please use "Paste Text" instead, or convert your PDF to Word format first.');
          }
        } else {
          text = await file.text();
        }
      } catch(fileError) {
        setUploadError(fileError.message || 'Could not read this file. Please try "Paste Text" instead.');
        setUploadSubState('selected');
        return;
      }

      if (!text || text.trim().length < 20) {
        setUploadError('The file appears empty or could not be parsed. Please try "Paste Text" instead.');
        setUploadSubState('selected');
        return;
      }

      if (selectedParserMode === 'ai') {
        setUseAI(true);
        await handleAIParse(text);
      } else {
        setUseAI(false);
        const result = parseProtocolDocument(text, classification);
        setParsed(result);
        setEditName(result.name); setEditDesc(result.description); setEditClass(result.classification);
        setEditDuration(result.estimated_duration_minutes ? String(result.estimated_duration_minutes) : '');
        setEditSections(result.sections_json || []); setEditSteps(result.steps || []); setEditChecklist(result.checklist_items || []);
        if (result._confidence === 'low') {
          setShowConfidenceGate(true);
          setUploadSubState('selected');
        } else {
          setStep(4);
        }
      }
    } catch(e) {
      console.error('Processing failed:', e);
      setUploadError(e.message || 'Processing failed. Please try "Paste Text" instead.');
      setUploadSubState('selected');
      setAiParsing(false);
    }
  };

  const handleAIParse = async (extractedText) => {
    setAiParsing(true);
    setAiError('');

    const sectorPrompt = SECTOR_AI_PROMPTS[classification] || SECTOR_AI_PROMPTS['General'];

    const granularityInstruction = `STEP EXTRACTION RULES — READ CAREFULLY:

Every individual bullet point or numbered action MUST become its own separate step.
The subsection name becomes the TITLE of each step in that subsection.

EXAMPLE — if the document has:
  6.1 Intake Inspection
    • Verify supplier documentation and traceability
    • Check product temperature on arrival
    • Inspect for visible defects

You MUST create 3 separate steps:
  Step 1: title="Intake Inspection", instruction="Verify supplier documentation and traceability"
  Step 2: title="Intake Inspection", instruction="Check product temperature on arrival"
  Step 3: title="Intake Inspection", instruction="Inspect for visible defects"

NEVER create a step like this (WRONG):
  Step 1: title="Intake Inspection", instruction="• Verify supplier... • Check product... • Inspect..."

RULES:
1. ONE bullet = ONE step. Never combine bullets into one instruction.
2. instruction = the single action text only — no bullet characters, no title repetition.
3. title = the subsection name shared by all steps in that group (max 60 chars).
4. If a subsection has 7 bullets → create 7 steps all with the same title.
5. If a section has no subsections but has numbered steps → each numbered item = one step, title = section name.
6. Total step count = total number of individual bullets and numbered actions in the procedure.
7. Strip all bullet characters (•, -, *) from the instruction text.`;

    const schemaDefinition = `OUTPUT SCHEMA — return ONLY this JSON structure, no markdown, no explanation:
{
  "name": "specific protocol name — never use generic titles like Standard Operating Procedure or SOP",
  "description": "1-3 sentence plain text summary",
  "classification": "one of exactly: Academic Research, Clinical Diagnostic, GMP Manufacturing, ISO Accredited, CRO Study, Biotech Startup, General",
  "estimated_duration_minutes": null,
  "compliance_tags": [],
  "steps": [
    {
      "step_order": 1,
      "title": null,
      "instruction": "action text ONLY — never copy the title",
      "is_critical": false,
      "timing_mode": "none",
      "expected_duration_seconds": null,
      "tolerance_lower_seconds": 0,
      "tolerance_upper_seconds": 0,
      "requires_measurement": false,
      "measurement_parameters": []
    }
  ],
  "checklist_items": [
    {"item_text": "material or equipment name", "category": "reagent or equipment or safety or other"}
  ]
}
TIMING: "none" no time, "advisory" time mentioned (operator starts), "strict" time-critical. Seconds: 5min=300, 2h=7200.
CRITICAL: is_critical=true for: critical, warning, caution, must not, do not, danger, NEVER, hazard.
MEASUREMENTS: requires_measurement=true + measurement_parameters when recording numeric values.`;

    const prompt = `You are BenchTrace AI — a laboratory protocol formatter.

SECTOR: ${classification}
${sectorPrompt.context}

EXAMPLES:
${sectorPrompt.examples}

${granularityInstruction}

${schemaDefinition}

PROTOCOL DOCUMENT:
${extractedText.substring(0, 12000)}`;

    try {
      const responseText = await base44.integrations.Core.InvokeLLM({ prompt });
      const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON object found in AI response');
      const aiResult = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));

      const { errors, warnings } = validateAIProtocolOutput(aiResult);
      if (errors.length > 0) throw new Error(`AI output validation failed: ${errors.join(', ')}`);

      const normalisedSteps = aiResult.steps.map((s, i) => {
        const timingMode = ['none', 'advisory', 'strict'].includes(s.timing_mode) ? s.timing_mode : 'none';
        const duration = (timingMode !== 'none' && s.expected_duration_seconds > 0) ? Math.round(Number(s.expected_duration_seconds)) : null;
        const tolLower = timingMode === 'strict' ? Math.max(0, Math.round(Number(s.tolerance_lower_seconds) || 0)) : 0;
        const tolUpper = timingMode === 'strict' ? Math.max(0, Math.round(Number(s.tolerance_upper_seconds) || 0)) : 0;
        const measureParams = Array.isArray(s.measurement_parameters)
          ? s.measurement_parameters.map(p => ({ name: p.name || '', unit: p.unit || '', min_value: p.min_value ?? null, max_value: p.max_value ?? null, required: p.required ?? true })).filter(p => p.name.length > 0)
          : [];
        // Clean instruction — strip bullet chars, unescape newlines
        let instruction = (s.instruction || s.title || 'Step instruction').trim();
        instruction = instruction
          .replace(/^[•\-\*◦▪▸►]\s*/u, '')   // remove leading bullet
          .replace(/\\n/g, '\n')               // unescape newlines
          .trim();
        // If AI still combined multiple bullets, take only the first action
        if (instruction.includes('\n•') || instruction.includes('\n-')) {
          instruction = instruction.split(/\n[•\-]/)[0].trim();
        }
        // Final safety — if empty, fall back to title
        if (!instruction || instruction.length < 2) {
          instruction = (s.title || `Step ${i + 1}`).trim();
        }

        return {
          step_order: i + 1,
          title: s.title ? String(s.title).substring(0, 200) : null,
          instruction,
          is_critical: s.is_critical === true,
          timing_mode: timingMode,
          expected_duration_seconds: duration,
          tolerance_lower_seconds: tolLower,
          tolerance_upper_seconds: tolUpper,
          requires_measurement: s.requires_measurement === true || measureParams.length > 0,
          measurement_parameters: measureParams,
          _id: `ai_s_${i}`,
        };
      });

      const validCats = ['reagent', 'equipment', 'safety', 'other'];
      const checklistItems = (aiResult.checklist_items || [])
        .map((item, i) => ({ item_text: (item.item_text || '').trim(), category: validCats.includes(item.category) ? item.category : 'other', _id: `ai_c_${i}` }))
        .filter(item => item.item_text.length > 2);

      const timedSteps = normalisedSteps.filter(s => s.timing_mode !== 'none').length;
      const criticalSteps = normalisedSteps.filter(s => s.is_critical).length;
      const measurementSteps = normalisedSteps.filter(s => s.requires_measurement).length;

      const result = {
        name: (aiResult.name || 'Imported Protocol').trim(),
        description: (aiResult.description || '').trim(),
        classification: aiResult.classification || classification || 'General',
        estimated_duration_minutes: aiResult.estimated_duration_minutes || null,
        compliance_tags: Array.isArray(aiResult.compliance_tags) ? aiResult.compliance_tags : [],
        steps: normalisedSteps,
        checklist_items: checklistItems,
        structured_materials: null,
        sections_json: [],
        _confidence: 'high',
        _parser_mode: 'ai_normalise',
        _detected_section: 'AI Normalised — individual steps',
        _ai_stats: {
          total_steps: normalisedSteps.length,
          timed_steps: timedSteps,
          critical_steps: criticalSteps,
          measurement_steps: measurementSteps,
          checklist_items: checklistItems.length,
          sector: classification,
          granularity: 'individual',
          warnings,
        },
      };

      setParsed(result);
      setEditName(result.name);
      setEditDesc(result.description);
      setEditClass(result.classification);
      setEditDuration(result.estimated_duration_minutes ? String(result.estimated_duration_minutes) : '');
      setEditSections([]);
      setEditSteps(result.steps);
      setEditChecklist(result.checklist_items);
      setShowConfidenceGate(false);
      setStep(4); // This drives navigation — do NOT call setUploadSubState after this

    } catch (e) {
      console.error('AI normalisation failed:', e);
      setUploadSubState('selected');
      try {
        const fallbackResult = parseProtocolDocument(extractedText, classification);
        fallbackResult._ai_fallback = true;
        setParsed(fallbackResult);
        setEditName(fallbackResult.name); setEditDesc(fallbackResult.description); setEditClass(fallbackResult.classification);
        setEditDuration(fallbackResult.estimated_duration_minutes ? String(fallbackResult.estimated_duration_minutes) : '');
        setEditSections(fallbackResult.sections_json || []); setEditSteps(fallbackResult.steps || []); setEditChecklist(fallbackResult.checklist_items || []);
        if (fallbackResult._confidence === 'low') { setShowConfidenceGate(true); } else { setStep(4); }
        setAiError(`AI parsing failed — using smart parser instead. (${e.message})`);
      } catch (fallbackErr) {
        setAiError(`Both AI and smart parser failed: ${e.message}. Please try a different file.`);
      }
    } finally {
      setAiParsing(false);
      // Do NOT reset uploadSubState here — success uses setStep(4), error already set 'selected'
    }
  };

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
      metadata: { source: 'import', step_count: parsed.steps?.length || 0, confidence: parsed._confidence, detected_section: parsed._detected_section, parser_mode: parsed._parser_mode || 'smart' },
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

      {device.isMobile && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 4, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💻</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>Best on desktop</div>
            <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>Protocol import works best on a desktop where you can easily access your DOCX files. You can still continue on mobile.</div>
          </div>
        </div>
      )}

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

      {/* Step 2 — Upload/Paste */}
      {step === 2 && uploadSubState !== 'processing' && (
        <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 2 of 3</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Upload Your Protocol</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>✨ AI extracts every action as an individual executable step</p>
          </div>

          {/* Mode selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20 }}>
            <button onClick={() => setInputMode('paste')} style={{ flex: 1, padding: '10px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: inputMode === 'paste' ? 700 : 500, background: inputMode === 'paste' ? 'white' : 'transparent', color: inputMode === 'paste' ? '#1e293b' : '#64748b', boxShadow: inputMode === 'paste' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 }}>
              📋 Paste Text
              {window.innerWidth < 768 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: '#6366f1', color: 'white' }}>MOBILE</span>}
            </button>
            <button onClick={() => setInputMode('upload')} style={{ flex: 1, padding: '10px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: inputMode === 'upload' ? 700 : 500, background: inputMode === 'upload' ? 'white' : 'transparent', color: inputMode === 'upload' ? '#1e293b' : '#64748b', boxShadow: inputMode === 'upload' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 }}>
              📄 Upload File
            </button>
          </div>

          {/* PASTE TEXT MODE */}
          {inputMode === 'paste' && (
            <div>
              <div style={{ padding: '12px 16px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca', marginBottom: 6 }}>📋 How to paste your protocol:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['1. Open your protocol in Google Docs, Word, or Notes', '2. Select all text (Ctrl+A or ⌘+A)', '3. Copy (Ctrl+C or ⌘+C)', '4. Tap below and paste (Ctrl+V or ⌘+V)'].map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#4338ca', lineHeight: 1.5 }}>{s}</div>
                  ))}
                </div>
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Paste your protocol text here...\n\nExample:\n1. Introduction\nPurpose: This protocol describes...\n\n2. Materials\n- Reagent A\n- Equipment B\n\n3. Procedure\n3.1 Sample preparation\n• Weigh 10g of sample\n• Add 100mL buffer..."}
                rows={12}
                style={{ width: '100%', padding: '16px', background: 'white', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 14, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif', minHeight: 200, color: '#1e293b' }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, marginBottom: 16, textAlign: 'right' }}>
                {pasteText.length} characters
                {pasteText.length > 0 && pasteText.length < 100 && <span style={{ color: '#dc2626' }}> — paste more text for better results</span>}
                {pasteText.length >= 100 && <span style={{ color: '#16a34a' }}> ✓ ready to process</span>}
              </div>
              {uploadError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
                  {uploadError}
                </div>
              )}
              <button
                onClick={async () => {
                  if (!pasteText.trim() || pasteText.trim().length < 50) {
                    setUploadError('Please paste more text — at least a few paragraphs of your protocol.');
                    return;
                  }
                  setUploadError('');
                  setUploadSubState('processing');
                  try {
                    if (selectedParserMode === 'ai') {
                      await handleAIParse(pasteText.trim());
                    } else {
                      const result = parseProtocolDocument(pasteText.trim(), classification);
                      setParsed(result);
                      setEditName(result.name); setEditDesc(result.description); setEditClass(result.classification);
                      setEditDuration(result.estimated_duration_minutes ? String(result.estimated_duration_minutes) : '');
                      setEditSections(result.sections_json || []); setEditSteps(result.steps || []); setEditChecklist(result.checklist_items || []);
                      if (result._confidence === 'low') {
                        setShowConfidenceGate(true);
                        setUploadSubState('idle');
                      } else {
                        setStep(4);
                      }
                    }
                  } catch(e) {
                    setUploadError(e.message || 'Processing failed. Please try again.');
                    setUploadSubState('idle');
                  }
                }}
                disabled={!pasteText.trim() || pasteText.trim().length < 50 || aiParsing}
                style={{ width: '100%', padding: '14px', background: !pasteText.trim() || pasteText.trim().length < 50 || aiParsing ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: !pasteText.trim() || pasteText.trim().length < 50 || aiParsing ? 'not-allowed' : 'pointer', minHeight: 52 }}
              >
                {aiParsing ? '✨ AI is reading your protocol...' : selectedParserMode === 'smart' ? '⚡ Parse with Smart Parser →' : '✨ Normalise with AI →'}
              </button>
            </div>
          )}

          {/* UPLOAD FILE MODE — Idle */}
          {inputMode === 'upload' && uploadSubState === 'idle' && (
            <div>
              {window.innerWidth < 768 && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                  <div style={{ fontSize: 12, color: '#92400e' }}>File upload can be unreliable on mobile. If you have issues, use <strong>Paste Text</strong> instead — it works perfectly on all devices.</div>
                </div>
              )}
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#6366f1'; }}
                onDragLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#c7d2fe';
                  const f = e.dataTransfer.files[0];
                  if (f) { setSelectedFile(f); setUploadSubState('selected'); setUploadError(''); }
                }}
                onClick={() => document.getElementById('bt-file-input').click()}
                style={{ border: '2px dashed #c7d2fe', borderRadius: 16, padding: '48px 32px', textAlign: 'center', background: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Drop your protocol here</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>or click to browse your files</div>
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  {['DOCX', 'TXT', 'MD'].map(ext => (
                    <span key={ext} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>{ext}</span>
                  ))}
                </div>
                <input id="bt-file-input" type="file"
                  accept=".docx,.doc,.txt,.md,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setUploadSubState('selected'); setUploadError(''); } e.target.value = ''; }}
                />
              </div>
              <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #eef2ff, #f0f9ff)', border: '1px solid #c7d2fe', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', marginBottom: 8 }}>✨ What AI does automatically for {classification} protocols:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                  {[
                    { icon: '⏱', text: 'Detects timers', sub: 'advisory & strict' },
                    { icon: '🔴', text: 'Flags critical steps', sub: 'warnings & must-dos' },
                    { icon: '📏', text: 'Extracts measurements', sub: 'with units & ranges' },
                    { icon: '🧪', text: 'Builds materials list', sub: 'reagents & equipment' },
                  ].map(item => (
                    <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{item.text}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Don't have a protocol yet?{' '}
                  <button onClick={e => { e.stopPropagation(); downloadSectorTemplate(classification); }}
                    style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'underline', padding: 0 }}>
                    Download our {classification} template →
                  </button>
                </span>
              </div>
            </div>
          )}

          {/* UPLOAD FILE MODE — File Selected */}
          {inputMode === 'upload' && uploadSubState === 'selected' && selectedFile && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{(selectedFile.size / 1024).toFixed(1)} KB · {classification}</div>
                </div>
                <button onClick={() => { setSelectedFile(null); setUploadSubState('idle'); setUploadError(''); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, flexShrink: 0 }}>×</button>
              </div>

              {uploadError && (
                <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Could not read this file</div>
                      <div style={{ fontSize: 12, color: '#b91c1c', lineHeight: 1.6, marginBottom: 12 }}>{uploadError}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => { setUploadError(''); setSelectedFile(null); setUploadSubState('idle'); }} style={{ padding: '7px 14px', background: 'white', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>Try Different File</button>
                        <button onClick={() => { setUploadError(''); setInputMode('paste'); }} style={{ padding: '7px 14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Use Paste Text Instead →</button>
                        <button onClick={() => downloadSectorTemplate(classification)} style={{ padding: '7px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Download Template</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div
                  onClick={() => {
                    if (!canAccess('ai_normaliser')) {
                      if (isBeta) switchPreviewPlan('lab');
                      return;
                    }
                    setSelectedParserMode('ai');
                  }}
                  style={{ padding: '20px', borderRadius: 12, cursor: canAccess('ai_normaliser') ? 'pointer' : (isBeta ? 'pointer' : 'not-allowed'), border: `2px solid ${selectedParserMode === 'ai' && canAccess('ai_normaliser') ? '#6366f1' : '#e2e8f0'}`, background: selectedParserMode === 'ai' && canAccess('ai_normaliser') ? 'linear-gradient(135deg, #eef2ff, #f0f9ff)' : 'white', transition: 'all 0.15s', position: 'relative', opacity: !canAccess('ai_normaliser') ? 0.8 : 1 }}>
                  <div style={{ position: 'absolute', top: -12, left: 20, background: canAccess('ai_normaliser') ? '#6366f1' : '#94a3b8', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 99, letterSpacing: '0.05em' }}>
                    {canAccess('ai_normaliser') ? '★ RECOMMENDED' : '🔒 LAB PLAN'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedParserMode === 'ai' && canAccess('ai_normaliser') ? '#6366f1' : '#cbd5e1'}`, background: selectedParserMode === 'ai' && canAccess('ai_normaliser') ? '#6366f1' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {selectedParserMode === 'ai' && canAccess('ai_normaliser') && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>✨</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>AI Protocol Normaliser</span>
                        {!canAccess('ai_normaliser') && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: '#6366f1', color: 'white' }}>LAB</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, marginBottom: selectedParserMode === 'ai' && canAccess('ai_normaliser') ? 12 : 0 }}>
                        {!canAccess('ai_normaliser')
                          ? isBeta
                            ? 'Click to preview as Lab plan and unlock AI Normaliser →'
                            : 'Requires Lab plan — AI reads your document and converts every action into executable steps.'
                          : 'AI reads your document and converts every action into an individual executable step — automatically detecting timers, critical steps, measurements, and materials.'
                        }
                      </div>
                      {selectedParserMode === 'ai' && canAccess('ai_normaliser') && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['⏱ Timers', '🔴 Critical steps', '📏 Measurements', '🧪 Materials'].map(tag => (
                            <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#4338ca', fontWeight: 600 }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div onClick={() => setSelectedParserMode('smart')} style={{ padding: '16px 20px', borderRadius: 12, cursor: 'pointer', border: `2px solid ${selectedParserMode === 'smart' ? '#64748b' : '#e2e8f0'}`, background: selectedParserMode === 'smart' ? '#f8fafc' : 'white', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedParserMode === 'smart' ? '#64748b' : '#cbd5e1'}`, background: selectedParserMode === 'smart' ? '#64748b' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {selectedParserMode === 'smart' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>⚡</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Smart Parser</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Fallback option</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>Regex-based structural parser. Fast and offline-capable. Works best with well-structured DOCX files using numbered steps.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setSelectedFile(null); setUploadSubState('idle'); setSelectedParserMode('ai'); setUploadError(''); }}
                  style={{ padding: '11px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>← Change File</button>
                <button
                  onClick={() => handleProcessFile(selectedFile)}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', color: 'white', background: selectedParserMode === 'ai' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#475569' }}
                >
                  {selectedParserMode === 'ai' ? '✨ Normalise with AI →' : '⚡ Parse with Smart Parser →'}
                </button>
              </div>

              {aiError && !uploadError && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⚠ {aiError}</span>
                  <button onClick={() => setAiError('')} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
          </div>
          <style>{`@keyframes bt-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 2 — Processing */}
      {step === 2 && uploadSubState === 'processing' && (
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif', padding: '40px 24px' }}>
          {selectedParserMode === 'ai' ? (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid #e0e7ff', borderTop: '4px solid #6366f1', animation: 'bt-spin 1s linear infinite', margin: '0 auto 24px' }} />
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>AI is reading your protocol...</h3>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>Converting to BenchTrace format for {classification}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', padding: '16px', background: '#eef2ff', borderRadius: 10 }}>
                {[
                  { icon: '📖', text: 'Reading document structure' },
                  { icon: '⏱', text: 'Detecting timed steps (advisory & strict)' },
                  { icon: '🔴', text: 'Flagging critical steps' },
                  { icon: '📏', text: 'Extracting measurement parameters' },
                  { icon: '🧪', text: 'Building materials checklist' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 12, color: '#4338ca', fontWeight: 500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16 }}>This usually takes 5-15 seconds</p>
            </>
          ) : (
            <>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #e2e8f0', borderTop: '3px solid #475569', animation: 'bt-spin 0.8s linear infinite', margin: '0 auto 20px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Analysing document structure...</h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Smart parser detecting sections and steps</p>
            </>
          )}
          <style>{`@keyframes bt-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 3 — Processing (legacy/paste) */}
      {step === 3 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-5" />
          <p className="text-base font-medium text-foreground">Analysing document...</p>
          <p className="text-sm text-muted-foreground mt-1">Parsing sections, steps, and materials.</p>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && parsed && (
        <div>
          {/* AI Normalisation stats badge */}
          {parsed._parser_mode === 'ai_normalise' && parsed._ai_stats && (
            <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #eef2ff, #f0f9ff)', border: '1px solid #c7d2fe', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>✨</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#4338ca' }}>AI Normalised — {parsed._ai_stats.sector || classification}</div>
                  <div style={{ fontSize: 11, color: '#6366f1' }}>{parsed._detected_section || 'AI Parsed'} · Review carefully then save</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { icon: '📋', label: 'Steps', value: parsed._ai_stats.total_steps, color: '#6366f1' },
                  { icon: '⏱', label: 'Timed', value: parsed._ai_stats.timed_steps, color: '#3b82f6' },
                  { icon: '🔴', label: 'Critical', value: parsed._ai_stats.critical_steps, color: '#dc2626' },
                  { icon: '📏', label: 'Measurements', value: parsed._ai_stats.measurement_steps, color: '#8b5cf6' },
                  { icon: '🧪', label: 'Materials', value: parsed._ai_stats.checklist_items, color: '#10b981' },
                ].map(stat => (
                  <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'white', borderRadius: 99, border: '1px solid #e0e7ff' }}>
                    <span style={{ fontSize: 12 }}>{stat.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: stat.color }}>{stat.value || 0}</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{stat.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#4338ca' }}>
                ◉ Individual steps — {parsed._ai_stats?.total_steps || 0} executable steps extracted
              </div>
              {parsed._ai_fallback && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#d97706' }}>⚡ AI failed — smart parser used as fallback</div>
              )}
            </div>
          )}

          {/* Protocol name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protocol Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {/* Steps list */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Execution Steps ({editSteps.length})
          </div>
          {editSteps.map((step, index) => {
            if (!step) return null;
            const isGrouped = !!(step.instruction && (step.instruction.includes('•') || step.instruction.includes('\n')) && step.instruction.length > 60);
            const timingMode = step.timing_mode || 'none';
            const isCritical = step.is_critical === true;
            const requiresMeasurement = step.requires_measurement === true;
            const hasDuration = !!(timingMode !== 'none' && step.expected_duration_seconds > 0);
            const durationLabel = hasDuration
              ? step.expected_duration_seconds >= 60
                ? `${Math.round(step.expected_duration_seconds / 60)}min`
                : `${step.expected_duration_seconds}s`
              : '';

            return (
              <div key={step._id || step.step_order || index} style={{
                background: 'white', borderRadius: 10,
                border: `1px solid ${isCritical ? '#fecaca' : '#e2e8f0'}`,
                borderLeft: `3px solid ${isCritical ? '#ef4444' : timingMode === 'strict' ? '#dc2626' : timingMode === 'advisory' ? '#3b82f6' : '#e2e8f0'}`,
                padding: '12px 16px', marginBottom: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', flexShrink: 0, minWidth: 22, marginTop: 2 }}>
                    {step.step_order || index + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    {step.title && step.title !== step.instruction && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {isGrouped && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>GROUP</span>}
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{step.title}</span>
                      </div>
                    )}
                    {(() => {
                      const instruction = step.instruction || '';
                      const lines = instruction.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                      const hasBullets = lines.length > 1 && lines.some(l => l.startsWith('•') || l.startsWith('-'));
                      if (hasBullets) {
                        return (
                          <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
                            {lines.map((line, li) => {
                              const clean = line.replace(/^[•\-\*]\s*/, '').trim();
                              if (!clean) return null;
                              return (
                                <li key={li} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                                  <span style={{ color: '#6366f1', flexShrink: 0, fontSize: 14, lineHeight: '1.4' }}>•</span>
                                  <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{clean}</span>
                                </li>
                              );
                            })}
                          </ul>
                        );
                      }
                      return <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{instruction}</div>;
                    })()}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {isCritical && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>🔴 CRITICAL</span>}
                      {timingMode === 'strict' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>⏱ STRICT {durationLabel}</span>}
                      {timingMode === 'advisory' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>⏱ ADVISORY {durationLabel}</span>}
                      {requiresMeasurement && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>📏 MEASURE</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditSteps(prev => prev.filter((_, i) => i !== index).map((st, i) => ({ ...st, step_order: i + 1 })))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 16, flexShrink: 0, padding: '0 2px' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                  >×</button>
                </div>
              </div>
            );
          })}

          {/* Save / back */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={() => { setStep(2); setUploadSubState('idle'); setParsed(null); }}
              style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#475569', fontWeight: 600 }}
            >
              ← Start Over
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editName.trim()}
              style={{ padding: '10px 28px', background: saving || !editName.trim() ? '#94a3b8' : '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving || !editName.trim() ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : `Save Protocol (${editSteps.length} steps) →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}