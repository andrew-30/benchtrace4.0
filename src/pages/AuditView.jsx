import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

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

  function handleDownloadReport() {
    if (!run) return;
    const L = [];
    L.push('BENCHTRACE 4.0 — AUDIT REPORT');
    L.push('='.repeat(60));
    L.push(`Generated:      ${new Date().toLocaleString()}`);
    L.push(`Run ID:         ${run.id}`);
    L.push(`Protocol:       ${protocol?.name || '—'}`);
    L.push(`Classification: ${protocol?.classification || '—'}`);
    L.push(`Operator:       ${run.operator_name || '—'}`);
    L.push(`Started:        ${tzFmt(run.run_started_at)}`);
    L.push(`Ended:          ${tzFmt(run.run_ended_at)}`);
    L.push(`Duration:       ${fmtDuration(run.run_started_at, run.run_ended_at)}`);
    L.push(`Status:         ${(run.run_state || '').toUpperCase()}`);
    L.push(`Result:         ${(run.result_status || 'pending').toUpperCase()}`);
    if (run.sample_reference) L.push(`Sample Ref:     ${run.sample_reference}`);
    if (run.instrument_id) L.push(`Instrument:     ${run.instrument_id}`);
    if (run.temperature) L.push(`Temperature:    ${run.temperature}°${run.temperature_unit === 'fahrenheit' ? 'F' : 'C'}`);
    if (run.humidity) L.push(`Humidity:       ${run.humidity}%`);
    L.push('');
    L.push('PRE-RUN CHECKLIST');
    L.push('-'.repeat(40));
    checklistItems.forEach(item => {
      const st = (run.checklist_completed || {})[item.id] || {};
      const v = st.verified ? '[✓]' : '[ ]';
      const lot = st.lot_number ? ` | Lot: ${st.lot_number}` : '';
      const exp = st.expiry_date ? ` | Exp: ${st.expiry_date}` : '';
      L.push(`${v} [${(item.category || '').toUpperCase().padEnd(9)}] ${item.item_text}${lot}${exp}`);
    });
    L.push('');
    L.push('EXECUTION STEPS');
    L.push('-'.repeat(40));
    let lastTitle = null;
    stepRuns.forEach(sr => {
      const step = steps.find(s => s.id === sr.step_id) || {};
      if (step.title && step.title !== lastTitle) {
        L.push(`\n  [ ${step.title.toUpperCase()} ]`);
        lastTitle = step.title;
      }
      const icon = sr.step_state === 'completed' ? '[✓]' : sr.step_state === 'skipped' ? '[⏭]' : '[ ]';
      L.push(`${icon} Step ${sr.step_order}: ${step.instruction || '—'}`);
      if (sr.step_completed_at) L.push(`      Completed: ${tzFmt(sr.step_completed_at)}`);
      if (sr.timer_elapsed_seconds > 0) L.push(`      Duration:  ${fmtElapsed(sr.timer_elapsed_seconds)}`);
      if (sr.notes) L.push(`      Notes: ${sr.notes}`);
      if (sr.deviation_flagged) L.push(`      ⚠ DEVIATION FLAGGED`);
      if (sr.measurement_values && Object.keys(sr.measurement_values).length > 0) {
        L.push(`      Measurements: ${Object.entries(sr.measurement_values).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      }
    });
    L.push('');
    L.push('DEVIATIONS');
    L.push('-'.repeat(40));
    if (deviations.length === 0) {
      L.push('No deviations recorded in this run.');
    } else {
      deviations.forEach((d, i) => {
        L.push(`${i + 1}. [${(d.severity || '').toUpperCase()}] Step ${d.step_order} — ${(d.deviation_type || 'other').replace(/_/g, ' ')}`);
        L.push(`   Description: ${d.description}`);
        L.push(`   Status: ${(d.status || '').toUpperCase()}`);
        if (d.resolution_notes) L.push(`   Resolution: ${d.resolution_notes}`);
        if (d.resolved_by_name) L.push(`   Resolved by: ${d.resolved_by_name} on ${tzFmt(d.resolved_at)}`);
        L.push('');
      });
    }
    L.push('');
    L.push('SIGN-OFF RECORD');
    L.push('-'.repeat(40));
    if (run.is_signed_off) {
      L.push(`Signed by: ${run.signed_off_by_name || '—'}`);
      L.push(`Date/Time: ${tzFmt(run.signed_off_at)}`);
      L.push(`Result:    ${(run.result_status || 'pending').toUpperCase()}`);
      L.push(`Run ID:    ${run.id}`);
    } else {
      L.push('This run has not been signed off.');
    }
    L.push('');
    L.push('='.repeat(60));
    L.push('Generated by BenchTrace 4.0 — ' + new Date().toLocaleString());

    const blob = new Blob([L.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BenchTrace_AuditReport_${(run.id || '').slice(-8)}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`@media print { .no-print { display:none!important; } body { background:white!important; font-size:11px; } * { box-shadow:none!important; } @page { margin:15mm; } }`}</style>

      {/* Sticky top bar */}
      <div className="no-print" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ padding: '6px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569' }}>← Back</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>🔍 Audit View — {protocol.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownloadReport} style={{ padding: '6px 14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📄 Download Report</button>
          <button onClick={() => window.print()} style={{ padding: '6px 14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🖨 Print / PDF</button>
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
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: '4px solid #16a34a', padding: '18px 20px', marginBottom: 16 }}>
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
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: '4px solid #6366f1', padding: '18px 20px', marginBottom: 16 }}>
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
                <div key={step.stepRunId || idx} style={{ padding: '10px 12px', background: step.deviation_flagged ? '#fffbeb' : '#f8fafc', border: `1px solid ${step.deviation_flagged ? '#fde68a' : '#f1f5f9'}`, borderLeft: `3px solid ${step.step_state === 'completed' ? '#16a34a' : step.step_state === 'skipped' ? '#f59e0b' : '#94a3b8'}`, borderRadius: 7, marginBottom: 5 }}>
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
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${deviations.length > 0 ? '#f59e0b' : '#16a34a'}`, padding: '18px 20px', marginBottom: 16 }}>
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
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${run.is_signed_off ? '#6366f1' : '#94a3b8'}`, padding: '18px 20px', marginBottom: 16 }}>
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
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#d97706' }}>⚠ This run has not yet been signed off.</div>
          )}
        </div>

      </div>
    </div>
  );
}