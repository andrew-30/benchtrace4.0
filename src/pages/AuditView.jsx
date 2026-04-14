import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import FeatureGate from "@/components/FeatureGate";
import { canAccess } from "@/lib/planGate";

const tzFmt = (dateStr) => {
  if (!dateStr) return '—';
  const tz = localStorage.getItem('bt_tz') || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date(dateStr));
  } catch(e) { return dateStr; }
};

const fmtDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return '—';
  const totalSec = Math.floor((new Date(endStr) - new Date(startStr)) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtElapsed = (sec) => {
  if (!sec || sec === 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function AuditView() {
  const navigate = useNavigate();
  const runId = new URLSearchParams(window.location.search).get('run_id');
  const orgId = localStorage.getItem('bt_org_id');
  const [run, setRun] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [stepRuns, setStepRuns] = useState([]);
  const [steps, setSteps] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const runData = await base44.entities.Run.filter({ organization_id: orgId, id: runId });
        const r = runData?.[0];
        if (!r) { setLoading(false); return; }
        const [protos, srs, sts, devs, cis] = await Promise.all([
          base44.entities.Protocol.filter({ organization_id: orgId, id: r.protocol_id }),
          base44.entities.StepRun.filter({ run_id: runId, organization_id: orgId }),
          base44.entities.ProtocolStep.filter({ protocol_id: r.protocol_id, organization_id: orgId }),
          base44.entities.Deviation.filter({ run_id: runId, organization_id: orgId }),
          base44.entities.ProtocolChecklistItem.filter({ protocol_id: r.protocol_id, organization_id: orgId }),
        ]);
        setRun(r);
        setProtocol(protos?.[0] || null);
        setStepRuns((srs || []).sort((a, b) => a.step_order - b.step_order));
        setSteps((sts || []).sort((a, b) => a.step_order - b.step_order));
        setDeviations(devs || []);
        setChecklistItems((cis || []).sort((a, b) => (a.item_order || 0) - (b.item_order || 0)));
      } catch(e) { console.error('Audit view load error:', e); }
      finally { setLoading(false); }
    };
    if (runId && orgId) load();
  }, [runId]);

  const handleDownloadPDF = async () => {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    const INDIGO = [99, 102, 241];
    const DARK = [30, 41, 59];
    const GRAY = [100, 116, 139];
    const LIGHT_GRAY = [241, 245, 249];
    const GREEN = [22, 163, 74];
    const RED = [220, 38, 38];
    const AMBER = [217, 119, 6];
    const WHITE = [255, 255, 255];

    // Strip non-ASCII characters that jsPDF Helvetica cannot render
    const safe = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u0394/g, 'Delta')
        .replace(/\u00B0/g, 'deg')
        .replace(/[^\x00-\x7F]/g, '');
    };

    const checkPage = (neededSpace) => {
      if (y + neededSpace > pageH - margin) {
        doc.addPage();
        y = margin;
        doc.setFillColor(...LIGHT_GRAY);
        doc.rect(0, 0, pageW, 10, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text('BenchTrace 4.0 - Audit Report', margin, 7);
        doc.text(`Run ID: ${(run.id || '').slice(-12)}`, pageW - margin, 7, { align: 'right' });
        y = 16;
      }
    };

    const sectionHeader = (title, color) => {
      checkPage(12);
      doc.setFillColor(...(color || INDIGO));
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.text(safe(title), margin + 4, y + 5.5);
      doc.setTextColor(...DARK);
      y += 12;
    };

    const kvRow = (key, value, indent) => {
      checkPage(7);
      const x = margin + (indent || 0);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY);
      doc.text(safe(key) + ':', x, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(safe(String(value || '--')), contentW - 45);
      doc.text(lines, x + 42, y);
      y += 5.5 * lines.length;
    };

    const checklistRow = (verified, text, lot, expiry, expired) => {
      checkPage(10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(verified ? GREEN : GRAY));
      doc.text(verified ? '[OK]' : '[--]', margin + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(safe(text), contentW - 60);
      doc.text(lines, margin + 10, y);
      let badgeX = margin + 10 + 80;
      if (lot) {
        doc.setFillColor(...LIGHT_GRAY);
        doc.roundedRect(badgeX, y - 3.5, 30, 5, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(`Lot: ${safe(lot)}`, badgeX + 2, y);
        badgeX += 33;
      }
      if (expiry) {
        doc.setFillColor(...(expired ? [254, 242, 242] : [240, 253, 244]));
        doc.roundedRect(badgeX, y - 3.5, 28, 5, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...(expired ? RED : GREEN));
        doc.text(expired ? 'EXPIRED' : `Exp: ${safe(expiry)}`, badgeX + 2, y);
      }
      y += 5.5 * lines.length + 1;
    };

    const stepRow = (stepNum, state, instruction, completedAt, elapsed, devFlagged, measurements, notes) => {
      checkPage(14);
      const stateColor = state === 'completed' ? GREEN : state === 'skipped' ? AMBER : GRAY;
      const stateIcon = state === 'completed' ? '[OK]' : state === 'skipped' ? '[SKIP]' : '[--]';
      doc.setFillColor(...stateColor);
      doc.rect(margin, y - 3, 1.5, 8, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...stateColor);
      doc.text(`${stateIcon} ${stepNum}`, margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      const instrLines = doc.splitTextToSize(safe(instruction || '--'), contentW - 18);
      doc.text(instrLines, margin + 14, y);
      y += 5 * instrLines.length;
      const subParts = [];
      if (completedAt) subParts.push(`Done: ${tzFmt(completedAt)}`);
      if (elapsed) subParts.push(`Time: ${fmtElapsed(elapsed)}`);
      if (devFlagged) subParts.push('[!] DEVIATION');
      if (notes) subParts.push(`Note: ${safe(notes)}`);
      if (subParts.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        const subLines = doc.splitTextToSize(subParts.join('   '), contentW - 14);
        doc.text(subLines, margin + 14, y);
        y += 4.5 * subLines.length;
      }
      if (measurements && Object.keys(measurements).length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(...GREEN);
        const mStr = Object.entries(measurements).map(([k, v]) => `${safe(k)}: ${safe(v)}`).join('  |  ');
        doc.text(`Meas: ${mStr}`, margin + 14, y);
        y += 4.5;
      }
      y += 2;
    };

    const deviationCard = (d) => {
      checkPage(30);
      const sevColor = d.severity === 'high' ? RED : d.severity === 'medium' ? AMBER : GRAY;
      doc.setFillColor(...sevColor);
      doc.roundedRect(margin + 2, y + 2, 20, 5, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...WHITE);
      doc.text((d.severity || 'low').toUpperCase(), margin + 4, y + 5.5);
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Step ${d.step_order || '--'}  -  ${safe((d.deviation_type || 'other').replace(/_/g, ' '))}`, margin + 26, y + 5.5);
      const statusColor = d.status === 'resolved' ? GREEN : RED;
      doc.setTextColor(...statusColor);
      doc.setFont('helvetica', 'bold');
      doc.text(d.status === 'resolved' ? '[RESOLVED]' : '[OPEN]', pageW - margin - 2, y + 5.5, { align: 'right' });
      y += 9;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      const descLines = doc.splitTextToSize(safe(d.description || ''), contentW - 4);
      doc.text(descLines, margin + 2, y);
      y += 5 * descLines.length + 2;
      if (d.resolution_notes) {
        doc.setFillColor(240, 253, 244);
        const resLines = doc.splitTextToSize(`Resolution: ${safe(d.resolution_notes)}`, contentW - 8);
        doc.rect(margin + 2, y - 1, contentW - 4, resLines.length * 5 + 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(22, 101, 52);
        doc.text(resLines, margin + 4, y + 3);
        y += resLines.length * 5 + 5;
      }
      if (d.resolved_by_name) {
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(`Resolved by: ${safe(d.resolved_by_name)}  on  ${tzFmt(d.resolved_at)}`, margin + 2, y);
        y += 5;
      }
      y += 4;
    };

    // --- PAGE 1 HEADER
    doc.setFillColor(...INDIGO);
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text('BenchTrace 4.0', margin, 10.5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('AUDIT REPORT', pageW - margin, 10.5, { align: 'right' });
    y = 22;
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`Generated: ${new Date().toLocaleString()}   |   Run ID: ${run.id}`, margin, y);
    y += 8;

    // --- SECTION 1 - RUN SUMMARY
    sectionHeader('1. RUN SUMMARY', DARK);
    const stateLabel = run.run_state === 'signed' ? '[SIGNED]' : run.run_state.toUpperCase();
    [['Protocol', safe(protocol?.name)], ['Classification', safe(protocol?.classification)], ['Operator', safe(run.operator_name)], ['Started', tzFmt(run.run_started_at)], ['Ended', tzFmt(run.run_ended_at)], ['Duration', fmtDuration(run.run_started_at, run.run_ended_at)], ['Status', stateLabel], ['Result', (run.result_status || 'pending').toUpperCase()]].forEach(([k, v]) => kvRow(k, v));
    if (run.sample_reference) kvRow('Sample Ref', safe(run.sample_reference));
    if (run.instrument_id) kvRow('Instrument', safe(run.instrument_id));
    if (run.temperature) kvRow('Temperature', `${run.temperature}${run.temperature_unit === 'fahrenheit' ? 'F' : 'C'}`);
    if (run.humidity) kvRow('Humidity', `${run.humidity}%`);
    y += 4;

    // --- SECTION 2 - PRE-RUN VERIFICATION
    sectionHeader('2. PRE-RUN VERIFICATION', [22, 101, 52]);
    const verifiedCountPDF = checklistItems.filter(i => (run.checklist_completed || {})[i.id]?.verified).length;
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${verifiedCountPDF} of ${checklistItems.length} items verified`, margin, y);
    y += 6;
    ['safety', 'equipment', 'reagent', 'other'].forEach(cat => {
      const items = checklistItems.filter(i => i.category === cat);
      if (!items.length) return;
      checkPage(8);
      const catColors = { safety: RED, equipment: [29, 78, 216], reagent: GREEN, other: GRAY };
      const catLabels = { safety: 'SAFETY', equipment: 'EQUIPMENT', reagent: 'REAGENT', other: 'OTHER' };
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(catColors[cat] || GRAY));
      doc.text(`${catLabels[cat]} (${items.length})`, margin, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      items.forEach(item => {
        const st = (run.checklist_completed || {})[item.id] || {};
        const expired = st.expiry_date && new Date(st.expiry_date) < new Date();
        checklistRow(st.verified, item.item_text, st.lot_number, st.expiry_date, expired);
      });
      y += 2;
    });
    y += 2;

    // --- SECTION 3 - EXECUTION RECORD
    sectionHeader('3. EXECUTION RECORD', [67, 56, 202]);
    const mergedStepsForPDF = stepRuns.map(sr => ({ ...sr, ...(steps.find(s => s.id === sr.step_id) || {}), stepRunId: sr.id }));
    let lastTitlePDF = null;
    mergedStepsForPDF.forEach(step => {
      const title = step.title?.trim() || null;
      if (title && title !== lastTitlePDF) {
        checkPage(10);
        doc.setFillColor(238, 242, 255);
        doc.rect(margin, y - 1, contentW, 7, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...INDIGO);
        doc.text(safe(title).toUpperCase(), margin + 4, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);
        y += 10;
        lastTitlePDF = title;
      }
      stepRow(step.step_order, step.step_state, step.instruction, step.step_completed_at, step.timer_elapsed_seconds, step.deviation_flagged, step.measurement_values && Object.keys(step.measurement_values).length > 0 ? step.measurement_values : null, step.notes);
    });
    y += 4;

    // --- SECTION 4 - DEVIATIONS
    sectionHeader('4. DEVIATIONS', deviations.length > 0 ? [217, 119, 6] : [22, 163, 74]);
    if (deviations.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(...GREEN);
      doc.text('No deviations recorded in this run.', margin, y);
      y += 8;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(`${deviations.length} deviation${deviations.length !== 1 ? 's' : ''} recorded`, margin, y);
      y += 6;
      deviations.forEach(d => deviationCard(d));
    }
    y += 2;

    // --- SECTION 5 - SIGN-OFF RECORD
    sectionHeader('5. SIGN-OFF RECORD', run.is_signed_off ? [67, 56, 202] : GRAY);
    if (run.is_signed_off) {
      [['Signed by', safe(run.signed_off_by_name || '--')], ['Date / Time', tzFmt(run.signed_off_at)], ['Result', (run.result_status || 'pending').toUpperCase()], ['Run ID', run.id]].forEach(([k, v]) => kvRow(k, v));
      y += 4;
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(margin, y, contentW, 10, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text('This record was generated by BenchTrace 4.0 and reflects the state of the run at the time of sign-off.', margin + 4, y + 4);
      y += 14;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...AMBER);
      doc.text('[!] This run has not yet been signed off.', margin, y);
      y += 8;
    }

    // --- FOOTER on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(0, pageH - 10, pageW, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(`BenchTrace 4.0 Audit Report  |  ${safe(protocol?.name || '')}  |  Generated: ${new Date().toLocaleDateString()}`, margin, pageH - 4);
      doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    const filename = `BenchTrace_AuditReport_${(run.id || '').slice(-8)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ color: '#6366f1', fontSize: 15 }}>Loading audit view...</div>
    </div>
  );

  if (!run || !protocol) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ color: '#ef4444' }}>Run not found.</div>
    </div>
  );

  const mergedSteps = stepRuns.map(sr => ({
    ...sr,
    ...(steps.find(s => s.id === sr.step_id) || {}),
    stepRunId: sr.id,
  }));

  const verifiedCount = checklistItems.filter(i => (run.checklist_completed || {})[i.id]?.verified).length;
  const completedCount = mergedSteps.filter(s => s.step_state === 'completed').length;
  const stateBadge = {
    signed:      { label: '✓ SIGNED',    bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
    completed:   { label: 'COMPLETED',   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    in_progress: { label: 'IN PROGRESS', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    abandoned:   { label: 'ABANDONED',   bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  }[run.run_state] || { label: run.run_state, bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };

  if (!canAccess('audit_view')) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <FeatureGate feature="audit_view" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-size: 10px !important; color: #000 !important; }
          * { box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 15mm; size: A4; }
          @page :first { margin-top: 10mm; }
          h1, h2 { page-break-after: avoid; }
          .section-card { page-break-inside: avoid; margin-bottom: 12px; }
          .step-row { page-break-inside: avoid; }
        }
      `}</style>

      {/* Sticky top bar */}
      <div className="no-print" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ padding: '6px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569' }}>← Back</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>🔍 Audit View — {protocol.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownloadPDF}
            style={{ padding:'6px 14px', background:'#1e293b', color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            📄 Download PDF
          </button>
          <button onClick={() => window.print()}
            style={{ padding:'6px 14px', background:'#6366f1', color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>

        {/* Run header card */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', borderTop: '4px solid #6366f1', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>{protocol.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: stateBadge.bg, color: stateBadge.color, border: `1px solid ${stateBadge.border}` }}>{stateBadge.label}</span>
            {run.result_status && run.result_status !== 'pending' && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: run.result_status === 'pass' ? '#f0fdf4' : '#fef2f2', color: run.result_status === 'pass' ? '#16a34a' : '#dc2626', border: `1px solid ${run.result_status === 'pass' ? '#bbf7d0' : '#fecaca'}` }}>
                {run.result_status === 'pass' ? '✓ PASS' : '✗ FAIL'}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '8px 24px' }}>
            {[
              ['Run ID', run.id.slice(-12)],
              ['Operator', run.operator_name || '—'],
              ['Started', tzFmt(run.run_started_at)],
              ['Ended', tzFmt(run.run_ended_at)],
              ['Duration', fmtDuration(run.run_started_at, run.run_ended_at)],
              ['Classification', protocol.classification || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}: </span>
                <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 1 — Pre-Run Verification */}
        <div className="section-card" style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: '4px solid #16a34a', padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✓</span> Pre-Run Verification
            <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>({verifiedCount}/{checklistItems.length} verified)</span>
          </div>
          {['safety', 'equipment', 'reagent', 'other'].map(cat => {
            const items = checklistItems.filter(i => i.category === cat);
            if (!items.length) return null;
            const CC = { safety: { icon: '🛡', color: '#dc2626' }, equipment: { icon: '⚙️', color: '#1d4ed8' }, reagent: { icon: '🧪', color: '#16a34a' }, other: { icon: '📋', color: '#475569' } };
            const c = CC[cat];
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.icon} {cat} ({items.length})</div>
                {items.map(item => {
                  const st = (run.checklist_completed || {})[item.id] || {};
                  const expired = st.expiry_date && new Date(st.expiry_date) < new Date();
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: expired ? '#fef2f2' : '#f8fafc', borderRadius: 6, marginBottom: 4, border: `1px solid ${expired ? '#fecaca' : '#f1f5f9'}` }}>
                      <span style={{ color: st.verified ? '#16a34a' : '#94a3b8', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{st.verified ? '✓' : '○'}</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#1e293b' }}>{item.item_text}</span>
                      {st.lot_number && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontFamily: 'monospace' }}>Lot: {st.lot_number}</span>}
                      {st.expiry_date && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: expired ? '#fef2f2' : '#f0fdf4', color: expired ? '#dc2626' : '#16a34a', border: `1px solid ${expired ? '#fecaca' : '#bbf7d0'}` }}>
                          {expired ? '🚫 EXPIRED' : `✓ Exp: ${st.expiry_date}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Section 2 — Execution Record */}
        <div className="section-card" style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: '4px solid #6366f1', padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋</span> Execution Record
            <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>({completedCount}/{mergedSteps.length} steps completed)</span>
          </div>
          {(() => {
            const rows = [];
            let lastTitle = null;
            mergedSteps.forEach((step, idx) => {
              const title = step.title?.trim() || null;
              if (title && title !== lastTitle) {
                rows.push(
                  <div key={`title_${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 6px' }}>
                    <div style={{ flex: 1, height: 1, background: '#e0e7ff' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 10px', background: '#eef2ff', borderRadius: 99 }}>{title}</span>
                    <div style={{ flex: 1, height: 1, background: '#e0e7ff' }} />
                  </div>
                );
                lastTitle = title;
              }
              const stepDevs = deviations.filter(d => d.step_run_id === step.stepRunId);
              rows.push(
                <div key={step.stepRunId || idx} className="step-row" style={{ padding: '10px 12px', background: step.deviation_flagged ? '#fffbeb' : '#f8fafc', border: `1px solid ${step.deviation_flagged ? '#fde68a' : '#f1f5f9'}`, borderLeft: `3px solid ${step.step_state === 'completed' ? '#16a34a' : step.step_state === 'skipped' ? '#f59e0b' : '#94a3b8'}`, borderRadius: 7, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{step.step_state === 'completed' ? '✓' : step.step_state === 'skipped' ? '⏭' : '○'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>#{step.step_order}</span>
                        <span style={{ fontSize: 13, color: '#1e293b' }}>{step.instruction || '—'}</span>
                        {step.deviation_flagged && <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '1px 7px', borderRadius: 99, border: '1px solid #fde68a' }}>⚠ DEV</span>}
                        {step.is_critical && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 7px', borderRadius: 99, border: '1px solid #fecaca' }}>CRITICAL</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                        {step.step_completed_at && <span style={{ fontSize: 10, color: '#64748b' }}>✓ {tzFmt(step.step_completed_at)}</span>}
                        {step.timer_elapsed_seconds > 0 && <span style={{ fontSize: 10, color: '#64748b' }}>⏱ {fmtElapsed(step.timer_elapsed_seconds)}</span>}
                        {step.notes && <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>📝 {step.notes}</span>}
                      </div>
                      {step.measurement_values && Object.keys(step.measurement_values).length > 0 && (
                        <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {Object.entries(step.measurement_values).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>📏 {k}: {v}</span>
                          ))}
                        </div>
                      )}
                      {stepDevs.map(d => (
                        <div key={d.id} style={{ marginTop: 6, padding: '5px 8px', background: '#fffbeb', borderRadius: 5, border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
                          ⚠ {d.description}{d.status === 'resolved' && <span style={{ color: '#16a34a', marginLeft: 8 }}>✓ Resolved</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            });
            return rows;
          })()}
        </div>

        {/* Section 3 — Deviations */}
        <div className="section-card" style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${deviations.length > 0 ? '#f59e0b' : '#16a34a'}`, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{deviations.length > 0 ? '⚠' : '✓'}</span> Deviations ({deviations.length})
          </div>
          {deviations.length === 0 ? (
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>✓ No deviations recorded in this run.</div>
          ) : deviations.map(d => (
            <div key={d.id} style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: d.severity === 'high' ? '#fef2f2' : d.severity === 'medium' ? '#fffbeb' : '#f8fafc', color: d.severity === 'high' ? '#dc2626' : d.severity === 'medium' ? '#d97706' : '#64748b', border: `1px solid ${d.severity === 'high' ? '#fecaca' : d.severity === 'medium' ? '#fde68a' : '#e2e8f0'}` }}>{(d.severity || 'low').toUpperCase()}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Step {d.step_order} · {(d.deviation_type || 'other').replace(/_/g, ' ')}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: d.status === 'resolved' ? '#f0fdf4' : '#fef2f2', color: d.status === 'resolved' ? '#16a34a' : '#dc2626', border: `1px solid ${d.status === 'resolved' ? '#bbf7d0' : '#fecaca'}` }}>
                  {d.status === 'resolved' ? '✓ RESOLVED' : 'OPEN'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 6 }}>{d.description}</div>
              {d.step_instruction && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 6 }}>Step: "{d.step_instruction}"</div>}
              {d.resolution_notes && (
                <div style={{ padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#166534', marginBottom: 4 }}>
                  <strong>Resolution:</strong> {d.resolution_notes}
                </div>
              )}
              {d.resolved_by_name && <div style={{ fontSize: 11, color: '#64748b' }}>Resolved by <strong>{d.resolved_by_name}</strong> on {tzFmt(d.resolved_at)}</div>}
            </div>
          ))}
        </div>

        {/* Section 4 — Sign-Off Record */}
        <div className="section-card" style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${run.is_signed_off ? '#6366f1' : '#94a3b8'}`, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{run.is_signed_off ? '✓' : '○'}</span> Sign-Off Record
          </div>
          {run.is_signed_off ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px', marginBottom: 12 }}>
                {[['Signed by', run.signed_off_by_name || '—'], ['Date / Time', tzFmt(run.signed_off_at)], ['Result', (run.result_status || 'pending').toUpperCase()], ['Run ID', run.id]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 11, color: '#64748b' }}>
                This record was generated by BenchTrace 4.0 and reflects the state of the run at the time of sign-off.
              </div>
              {run?.signature_hash && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Signature Hash (SHA-256)</div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', wordBreak: 'break-all', lineHeight: '1.4' }}>{run.signature_hash}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#d97706' }}>⚠ This run has not yet been signed off.</div>
          )}
        </div>

      </div>
    </div>
  );
}