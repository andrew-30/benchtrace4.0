import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

function useDeviceType() {
  const [device, setDevice] = useState(() => {
    const w = window.innerWidth;
    return { isMobile: w < 768, isTablet: w >= 768 && w < 1200, isDesktop: w >= 1200, isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0, isLandscape: window.innerWidth > window.innerHeight, width: w };
  });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setDevice({ isMobile: w < 768, isTablet: w >= 768 && w < 1200, isDesktop: w >= 1200, isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0, isLandscape: window.innerWidth > window.innerHeight, width: w });
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return device;
}

function fmtSec(sec) {
  const abs = Math.abs(sec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function AbandonRunModal({ onConfirm, onCancel, abandoning }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [reasonError, setReasonError] = useState('');

  const ABANDON_REASONS = [
    'Equipment failure',
    'Operator error',
    'Sample contamination detected',
    'Protocol deviation — cannot continue',
    'Reagent issue (expired, wrong lot)',
    'External event (power failure, emergency)',
    'Other',
  ];

  function handleConfirm() {
    if (!reason) { setReasonError('Please select a reason for abandoning this run.'); return; }
    onConfirm(reason, notes.trim());
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', borderRadius: 14, width: '100%', maxWidth: 440, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ background: '#0f172a', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 2 }}>Abandon this run?</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>This action cannot be undone. The run will be marked as abandoned.</div>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Reason for abandoning *</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ABANDON_REASONS.map(r => (
                <button key={r} onClick={() => { setReason(r); setReasonError(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 13, border: `1px solid ${reason === r ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, background: reason === r ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', color: reason === r ? '#fca5a5' : '#94a3b8', fontWeight: reason === r ? 700 : 400 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${reason === r ? '#ef4444' : 'rgba(255,255,255,0.2)'}`, background: reason === r ? '#ef4444' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {reason === r && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                  </div>
                  {r}
                </button>
              ))}
            </div>
            {reasonError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{reasonError}</div>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Additional notes (optional)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe what happened..." rows={3}
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', fontSize: 13, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} disabled={abandoning}
              style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#94a3b8', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleConfirm} disabled={abandoning}
              style={{ flex: 2, padding: '10px', background: abandoning ? '#475569' : '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: abandoning ? 'not-allowed' : 'pointer' }}>
              {abandoning ? 'Abandoning...' : 'Abandon Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTimerBlock({ step, timerState, elapsed, onStart, onPause, onRestart, large = false }) {
  if (!step || step.timing_mode === 'none' || !step.expected_duration_seconds) return null;

  const timerFontSize = large ? 72 : 52;
  const buttonHeight = large ? 56 : 44;
  const buttonFontSize = large ? 16 : 14;

  const target = step.expected_duration_seconds;
  const isStrict = step.timing_mode === 'strict';
  const tolLower = step.tolerance_lower_seconds || 0;
  const tolUpper = step.tolerance_upper_seconds || 0;
  const windowMin = target - tolLower;
  const windowMax = target + tolUpper;

  const displayValue = isStrict ? target - elapsed : elapsed;
  const isOvertime = isStrict && elapsed > target;
  const isWithinWindow = isStrict && elapsed >= windowMin && elapsed <= windowMax;
  const progressPct = Math.min((elapsed / target) * 100, 100);

  const timerColor = (() => {
    if (timerState === 'idle') return '#64748b';
    if (isStrict) {
      if (isOvertime) return '#dc2626';
      if (elapsed >= target * 0.8) return '#d97706';
      return '#6366f1';
    }
    return '#6366f1';
  })();

  const bgColor = isStrict ? (isOvertime ? '#fef2f2' : '#f8fafc') : '#f8fafc';
  const borderColor = isStrict
    ? (isOvertime ? '#fecaca' : timerState === 'running' ? '#c7d2fe' : '#e2e8f0')
    : (timerState === 'running' ? '#c7d2fe' : '#e2e8f0');

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, padding: large ? '20px 24px' : '16px 18px', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: timerColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isStrict ? '🔴 Strict Timer' : '⏱ Advisory Timer'}
          </span>
          {timerState === 'idle' && <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>Press Start when ready</span>}
          {timerState === 'running' && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>● RUNNING</span>}
          {timerState === 'paused' && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>⏸ PAUSED</span>}
        </div>
        <span style={{ fontSize: 11, color: '#64748b' }}>Target: {fmtSec(target)}</span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: timerFontSize, fontWeight: 900, fontFamily: 'monospace', color: timerState === 'idle' ? '#94a3b8' : timerColor, lineHeight: 1, letterSpacing: '-1px' }}>
          {isOvertime ? `+${fmtSec(elapsed - target)}` : fmtSec(Math.abs(displayValue))}
        </div>
        {isOvertime && <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>OVERTIME</div>}
        {isStrict && !isOvertime && elapsed > 0 && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{fmtSec(elapsed)} elapsed of {fmtSec(target)} target</div>}
        {!isStrict && elapsed > 0 && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{fmtSec(elapsed)} elapsed · Target: {fmtSec(target)}</div>}
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', borderRadius: 3, background: isOvertime ? '#dc2626' : progressPct >= 80 ? '#d97706' : timerColor, width: `${progressPct}%`, transition: 'width 0.5s ease, background 0.3s ease' }} />
      </div>
      {isStrict && (tolLower > 0 || tolUpper > 0) && (
        <div style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 10, background: isWithinWindow ? '#f0fdf4' : isOvertime ? '#fef2f2' : '#fffbeb', border: `1px solid ${isWithinWindow ? '#bbf7d0' : isOvertime ? '#fecaca' : '#fde68a'}` }}>
          <div style={{ fontSize: 11, color: isWithinWindow ? '#16a34a' : isOvertime ? '#dc2626' : '#d97706', fontWeight: 600 }}>
            {isWithinWindow ? `✓ Within tolerance window: ${fmtSec(windowMin)} → ${fmtSec(windowMax)}` : elapsed === 0 ? `Tolerance window: ${fmtSec(windowMin)} → ${fmtSec(windowMax)}` : isOvertime && elapsed > windowMax ? `⚠ Outside window — overtime by ${fmtSec(elapsed - windowMax)}` : `Tolerance window: ${fmtSec(windowMin)} → ${fmtSec(windowMax)}`}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {timerState === 'idle' && (
          <button onClick={onStart} style={{ flex: 1, height: buttonHeight, background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: buttonFontSize, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>▶ Start Timer</button>
        )}
        {timerState === 'running' && (
          <>
            <button onClick={onPause} style={{ flex: 1, height: buttonHeight, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 10, fontSize: buttonFontSize, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>⏸ Pause</button>
            <button onClick={onRestart} style={{ padding: `0 ${large ? 20 : 14}px`, height: buttonHeight, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: buttonFontSize, fontWeight: 600, cursor: 'pointer' }}>↺ Restart</button>
          </>
        )}
        {timerState === 'paused' && (
          <>
            <button onClick={onStart} style={{ flex: 1, height: buttonHeight, background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: buttonFontSize, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>▶ Resume</button>
            <button onClick={onRestart} style={{ padding: `0 ${large ? 20 : 14}px`, height: buttonHeight, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, fontSize: buttonFontSize, fontWeight: 600, cursor: 'pointer' }}>↺ Restart</button>
          </>
        )}
      </div>
      {!isStrict && <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>Advisory timer — for reference only, no deviation flagging</div>}
    </div>
  );
}

function RunLiveMonitor({ run, protocol, mergedSteps, stepRuns, currentUser, onRequestControl, navigate }) {
  const role = localStorage.getItem('bt_role');
  const isAdmin = role === 'admin';
  const completedSteps = (stepRuns || []).filter(sr => sr.step_state === 'completed').length;
  const totalSteps = (mergedSteps || []).length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const currentStepIndex = completedSteps;
  const currentStep = mergedSteps?.[currentStepIndex];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes bt-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/runs')} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>← Runs</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{protocol?.name}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>{run.operator_name} · Read-only monitoring</div>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 99, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', animation: 'bt-pulse 1.5s infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>LIVE</span>
        </div>
      </div>
      <div style={{ paddingTop: 72, maxWidth: 700, margin: '0 auto', padding: '72px 20px 40px' }}>
        <div style={{ padding: '16px 20px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 2 }}>{run.operator_name} is executing this run</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>You are viewing in read-only mode. Only {run.operator_name} can complete steps.</div>
          </div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Progress</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{progressPct}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 4, background: '#6366f1', width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{completedSteps} of {totalSteps} steps completed</div>
        </div>
        {currentStep && (
          <div style={{ background: '#1e293b', border: '2px solid #6366f1', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Currently executing — Step {currentStepIndex + 1}</div>
            {currentStep.title && <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{currentStep.title}</div>}
            <div style={{ fontSize: 15, fontWeight: 600, color: 'white', lineHeight: 1.6 }}>{currentStep.instruction}</div>
            {currentStep.is_critical && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: '#fca5a5' }}>🔴 CRITICAL STEP</div>}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>All Steps ({totalSteps})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32 }}>
          {(mergedSteps || []).map((step, idx) => {
            const stepRun = (stepRuns || []).find(sr => sr.step_order === step.step_order);
            const isDone = stepRun?.step_state === 'completed';
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={step._id || idx} style={{ padding: '10px 14px', borderRadius: 8, background: isDone ? 'rgba(22,163,74,0.1)' : isCurrent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isDone ? 'rgba(22,163,74,0.3)' : isCurrent ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isDone ? '#16a34a' : isCurrent ? '#6366f1' : 'rgba(255,255,255,0.08)', color: isDone || isCurrent ? 'white' : '#64748b' }}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {step.title && <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{step.title}</div>}
                  <div style={{ fontSize: 12, color: isDone ? '#86efac' : isCurrent ? '#a5b4fc' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.instruction}</div>
                </div>
                {step.is_critical && !isDone && <div style={{ fontSize: 10, color: '#fca5a5' }}>🔴</div>}
              </div>
            );
          })}
        </div>
        {isAdmin && (
          <div style={{ padding: '16px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', marginBottom: 6 }}>Emergency Control</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 12 }}>If {run.operator_name} is unavailable, you can take control of this run. This action will be permanently recorded in the audit trail.</div>
            <button onClick={onRequestControl} style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⚡ Request Emergency Control</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RunExecution() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('bt_org_id');
  const runId = new URLSearchParams(window.location.search).get('id');
  const device = useDeviceType();

  const [currentUser, setCurrentUser] = useState(null);
  const [isOperator, setIsOperator] = useState(false);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [requestingControl, setRequestingControl] = useState(false);
  const [run, setRun] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [mergedSteps, setMergedSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stepNotes, setStepNotes] = useState('');
  const [measurementValues, setMeasurementValues] = useState({});
  const [runElapsed, setRunElapsed] = useState(0);
  const [timerState, setTimerState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const timerIntervalRef = useRef(null);
  const elapsedRef = useRef(0);
  const [showStepsOverview, setShowStepsOverview] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [timerResumedToast, setTimerResumedToast] = useState(false);
  const [timerResumedSeconds, setTimerResumedSeconds] = useState(0);
  const [abandoning, setAbandoning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const runTimerRef = useRef(null);

  const clearTimerInterval = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  };

  const handleStartTimer = async () => {
    const now = new Date().toISOString();
    timerIntervalRef.current = setInterval(() => { elapsedRef.current += 1; setElapsed(elapsedRef.current); }, 1000);
    setTimerState('running');
    try {
      if (currentStep?.stepRunId) await base44.entities.StepRun.update(currentStep.stepRunId, { step_started_at: now, step_state: 'active' });
    } catch(e) { console.error('Failed to persist timer start:', e); }
  };

  const handlePauseTimer = async () => {
    clearTimerInterval();
    setTimerState('paused');
    try {
      if (currentStep?.stepRunId) await base44.entities.StepRun.update(currentStep.stepRunId, { timer_elapsed_seconds: elapsedRef.current });
    } catch(e) { console.error('Failed to save elapsed on pause:', e); }
  };

  const handleRestartTimer = () => { clearTimerInterval(); elapsedRef.current = 0; setElapsed(0); setTimerState('idle'); };

  useEffect(() => {
    clearTimerInterval();
    elapsedRef.current = 0;
    setElapsed(0);
    setTimerState('idle');
    const step = mergedSteps?.[currentStepIndex];
    if (step?.timing_mode !== 'none' && step?.expected_duration_seconds > 0 && run?.run_state === 'in_progress' && step?.stepRunId) {
      const restoreTimer = async () => {
        try {
          const rows = await base44.entities.StepRun.filter({ id: step.stepRunId });
          const stepRunData = rows?.[0];
          if (!stepRunData) return;
          if (stepRunData.step_started_at && !stepRunData.step_completed_at) {
            const wallClockElapsed = Math.floor((Date.now() - new Date(stepRunData.step_started_at).getTime()) / 1000);
            if (wallClockElapsed > 0 && wallClockElapsed < 86400) {
              elapsedRef.current = wallClockElapsed; setElapsed(wallClockElapsed); setTimerState('running');
              timerIntervalRef.current = setInterval(() => { elapsedRef.current += 1; setElapsed(elapsedRef.current); }, 1000);
              setTimerResumedSeconds(wallClockElapsed); setTimerResumedToast(true);
              setTimeout(() => setTimerResumedToast(false), 4000);
              return;
            }
          }
          if (stepRunData.timer_elapsed_seconds > 0 && !stepRunData.step_completed_at) {
            elapsedRef.current = stepRunData.timer_elapsed_seconds; setElapsed(stepRunData.timer_elapsed_seconds); setTimerState('paused');
          }
        } catch(e) { console.error('Timer restore failed:', e); }
      };
      restoreTimer();
    }
    return () => clearTimerInterval();
  }, [currentStepIndex, run?.run_state]);

  useEffect(() => {
    if (timerState !== 'running') return;
    const saveInterval = setInterval(async () => {
      try {
        const step = mergedSteps?.[currentStepIndex];
        if (step?.stepRunId && elapsedRef.current > 0) await base44.entities.StepRun.update(step.stepRunId, { timer_elapsed_seconds: elapsedRef.current });
      } catch(e) { console.error('Periodic timer save failed:', e); }
    }, 10000);
    return () => clearInterval(saveInterval);
  }, [timerState, currentStepIndex]);

  useEffect(() => { return () => { clearTimerInterval(); clearInterval(runTimerRef.current); }; }, []);

  useEffect(() => {
    async function load() {
      if (!runId) { navigate('/runs'); return; }
      const [runData, stepRunsData] = await Promise.all([
        base44.entities.Run.filter({ organization_id: orgId, id: runId }),
        base44.entities.StepRun.filter({ organization_id: orgId, run_id: runId }, 'step_order'),
      ]);
      if (!runData || runData.length === 0) { navigate('/runs'); return; }
      const r = runData[0];
      const [stepsData, protocolData] = await Promise.all([
        base44.entities.ProtocolStep.filter({ organization_id: orgId, protocol_id: r.protocol_id }, 'step_order'),
        base44.entities.Protocol.filter({ organization_id: orgId, id: r.protocol_id }),
      ]);
      setProtocol(protocolData?.[0] || null);
      const merged = stepRunsData.map(sr => ({ ...stepsData.find(s => s.id === sr.step_id), ...sr, stepRunId: sr.id })).sort((a, b) => a.step_order - b.step_order);
      setRun(r);
      setMergedSteps(merged);
      const firstPending = merged.findIndex(s => s.step_state === 'pending' || s.step_state === 'active');
      setCurrentStepIndex(firstPending >= 0 ? firstPending : 0);
      if (r.run_started_at) setRunElapsed(Math.floor((Date.now() - new Date(r.run_started_at)) / 1000));
      setLoading(false);
    }
    load();
  }, [runId, orgId]);

  useEffect(() => {
    if (!run) return;
    runTimerRef.current = setInterval(() => setRunElapsed(p => p + 1), 1000);
    return () => clearInterval(runTimerRef.current);
  }, [run]);

  // Load current user and check operator status
  useEffect(() => {
    async function loadUser() {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (run) setIsOperator(run.operator_user_id === user.id);
      } catch(e) { console.error('Failed to load user:', e); }
    }
    if (run) loadUser();
  }, [run?.id, run?.operator_user_id]);

  const currentStep = mergedSteps[currentStepIndex];

  async function handleCompleteStep() {
    if (!currentStep || currentStep.step_state === 'completed' || completing) return;
    setCompleting(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    const actualElapsed = elapsed;
    let deviationFlagged = false;
    if (currentStep.timing_mode === 'strict' && currentStep.expected_duration_seconds > 0 && timerState !== 'idle') {
      const lower = currentStep.expected_duration_seconds - (currentStep.tolerance_lower_seconds || 0);
      const upper = currentStep.expected_duration_seconds + (currentStep.tolerance_upper_seconds || 0);
      if (actualElapsed < lower || actualElapsed > upper) deviationFlagged = true;
    }
    if (currentStep.measurement_parameters?.length > 0) {
      for (const param of currentStep.measurement_parameters) {
        const val = measurementValues[param.name];
        if (val != null && ((param.min_value != null && Number(val) < param.min_value) || (param.max_value != null && Number(val) > param.max_value))) deviationFlagged = true;
      }
    }
    clearTimerInterval();
    await base44.entities.StepRun.update(currentStep.stepRunId, { step_state: 'completed', step_completed_at: now, timer_elapsed_seconds: actualElapsed, measurement_values: measurementValues, notes: stepNotes, deviation_flagged: deviationFlagged });
    await base44.entities.AuditLog.create({ organization_id: orgId, entity_type: 'StepRun', entity_id: currentStep.stepRunId, event_type: 'step_completed', actor_user_id: user.id, actor_email: user.email, metadata: { step_order: currentStep.step_order, elapsed: actualElapsed, deviation_flagged: deviationFlagged }, created_at: now });
    const updated = mergedSteps.map((s, i) => i === currentStepIndex ? { ...s, step_state: 'completed', deviation_flagged: deviationFlagged } : s);
    setMergedSteps(updated);
    const isLast = currentStepIndex >= mergedSteps.length - 1;
    if (isLast) {
      await base44.entities.Run.update(runId, { run_state: 'completed', run_ended_at: now });
      await base44.entities.AuditLog.create({ organization_id: orgId, entity_type: 'Run', entity_id: runId, event_type: 'run_completed', actor_user_id: user.id, actor_email: user.email, metadata: { total_steps: mergedSteps.length }, created_at: now });
      navigate(`/run-detail?id=${runId}`);
      return;
    }
    setCurrentStepIndex(p => p + 1);
    setStepNotes('');
    setMeasurementValues({});
    setCompleting(false);
  }

  async function handleSkipStep() {
    if (!currentStep) return;
    const now = new Date().toISOString();
    await base44.entities.StepRun.update(currentStep.stepRunId, { step_state: 'skipped', step_completed_at: now });
    const updated = mergedSteps.map((s, i) => i === currentStepIndex ? { ...s, step_state: 'skipped' } : s);
    setMergedSteps(updated);
    setShowSkipConfirm(false);
    const isLast = currentStepIndex >= mergedSteps.length - 1;
    if (isLast) { await base44.entities.Run.update(runId, { run_state: 'completed', run_ended_at: now }); navigate(`/run-detail?id=${runId}`); return; }
    setCurrentStepIndex(p => p + 1);
    setStepNotes('');
    setMeasurementValues({});
  }

  async function handleAbandon(reason, notes) {
    setAbandoning(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    await base44.entities.Run.update(runId, { run_state: 'abandoned', result_status: 'abandoned', run_ended_at: now, context_notes: notes ? `Abandoned: ${reason}. ${notes}` : `Abandoned: ${reason}` });
    await base44.entities.AuditLog.create({ organization_id: orgId, entity_type: 'Run', entity_id: runId, event_type: 'run_abandoned', actor_user_id: user.id, actor_email: user.email, metadata: { abandon_reason: reason, abandon_notes: notes || '', abandoned_at_step: currentStepIndex + 1, total_steps: mergedSteps?.length || 0 }, created_at: now });
    navigate('/runs');
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading run...</p>
        </div>
      </div>
    );
  }

  const completedCount = mergedSteps.filter(s => s.step_state === 'completed' || s.step_state === 'skipped').length;

  // Read-only monitoring view for non-operators
  if (run && run.run_state === 'in_progress' && currentUser && !isOperator) {
    return (
      <>
        <RunLiveMonitor
          run={run}
          protocol={protocol}
          mergedSteps={mergedSteps}
          stepRuns={mergedSteps}
          currentUser={currentUser}
          onRequestControl={() => setShowTakeoverConfirm(true)}
          navigate={navigate}
        />
        {showTakeoverConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ background: '#1e293b', borderRadius: 14, maxWidth: 440, width: '100%', border: '1px solid rgba(239,68,68,0.3)', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(239,68,68,0.1)', padding: '16px 20px', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fca5a5' }}>⚡ Emergency Run Takeover</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>This action is permanent and audited</div>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 16 }}>
                  You are about to take control of <strong style={{ color: 'white' }}>{run?.operator_name}</strong>'s run. This will be recorded permanently in the audit trail. All subsequent steps will show your name as the operator.
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#fbbf24' }}>
                  ⚠ Only use this for genuine emergencies — operator unavailable, device failure, or safety incident.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowTakeoverConfirm(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={async () => {
                      setRequestingControl(true);
                      const user = await base44.auth.me();
                      await base44.entities.Run.update(run.id, {
                        operator_user_id: user.id,
                        operator_name: user.full_name || user.email,
                        context_notes: `${run.context_notes || ''} | Emergency takeover by ${user.full_name || user.email} at ${new Date().toISOString()}`.trim(),
                      });
                      await base44.entities.AuditLog.create({
                        organization_id: orgId, event_type: 'run_takeover',
                        actor_user_id: user.id, actor_email: user.email,
                        metadata: { run_id: run.id, original_operator: run.operator_name, original_operator_id: run.operator_user_id, takeover_reason: 'emergency', step_at_takeover: completedCount + 1 },
                        created_at: new Date().toISOString(),
                      });
                      setShowTakeoverConfirm(false);
                      setIsOperator(true);
                      setCurrentUser(user);
                      setRequestingControl(false);
                    }}
                    disabled={requestingControl}
                    style={{ flex: 2, padding: '10px', background: requestingControl ? '#475569' : '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: requestingControl ? 'not-allowed' : 'pointer' }}
                  >
                    {requestingControl ? 'Taking control...' : 'Yes, Take Control'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const miniHeader = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: device.isMobile ? '8px 12px' : '8px 16px', display: 'flex', alignItems: 'center', gap: device.isMobile ? 8 : 12, fontFamily: 'system-ui, sans-serif' }}>
      {!showExitConfirm ? (
        <button onClick={() => setShowExitConfirm(true)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, minHeight: device.isMobile ? 40 : 32, minWidth: device.isMobile ? 72 : 60 }}>← Runs</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Leave run? It stays in progress.</span>
          <button onClick={() => navigate('/runs')} style={{ padding: '4px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Yes, leave</button>
          <button onClick={() => setShowExitConfirm(false)} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: device.isMobile ? 13 : 12, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{protocol?.name || 'Run in Progress'}</div>
        {!device.isMobile && <div style={{ fontSize: 10, color: '#64748b' }}>{run?.operator_name || '—'} · Started {run?.run_started_at ? new Date(run.run_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>Step {currentStepIndex + 1} of {mergedSteps?.length || 0}</div>
          <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 2 }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#6366f1', width: `${mergedSteps?.length > 0 ? ((currentStepIndex + 1) / mergedSteps.length) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <div style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', fontSize: 10, fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', animation: 'bt-pulse 1.5s infinite' }} />
          LIVE
        </div>
      </div>
    </div>
  );

  return (
    <>
      {miniHeader}
      <div style={{ height: 52 }} />
      <style>{`@keyframes bt-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {timerResumedToast && (
        <div style={{ position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 8, padding: '10px 16px', zIndex: 300, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ fontSize: 14 }}>⏱</span>
          <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>Timer resumed — {timerResumedSeconds >= 60 ? `${Math.floor(timerResumedSeconds / 60)}m ${timerResumedSeconds % 60}s` : `${timerResumedSeconds}s`} elapsed</span>
        </div>
      )}

      {(device.isTablet || device.isMobile) ? (
        /* ── TABLET / MOBILE LAYOUT ── */
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', paddingTop: 52 }}>
          {/* Progress bar */}
          <div style={{ background: '#1e293b', padding: '10px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Step {currentStepIndex + 1} of {mergedSteps?.length || 0}</span>
              <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{mergedSteps?.length > 0 ? Math.round(((currentStepIndex + 1) / mergedSteps.length) * 100) : 0}% complete</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: '#6366f1', width: `${mergedSteps?.length > 0 ? ((currentStepIndex + 1) / mergedSteps.length) * 100 : 0}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: device.isMobile ? '20px 16px 120px' : '24px 32px 120px' }}>
            {currentStep?.title && (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 1, flex: 1, background: 'rgba(99,102,241,0.3)' }} />
                {currentStep.title}
                <div style={{ height: 1, flex: 1, background: 'rgba(99,102,241,0.3)' }} />
              </div>
            )}
            {currentStep?.is_critical && (
              <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>Critical Step — follow exactly as written</span>
              </div>
            )}
            <div style={{ fontSize: device.isMobile ? 17 : 20, fontWeight: 600, color: 'white', lineHeight: 1.7, marginBottom: 24, padding: device.isMobile ? '16px' : '24px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
              {currentStep?.instruction || ''}
            </div>
            {currentStep?.timing_mode !== 'none' && currentStep?.expected_duration_seconds > 0 && (
              <StepTimerBlock step={currentStep} timerState={timerState} elapsed={elapsed} onStart={handleStartTimer} onPause={handlePauseTimer} onRestart={handleRestartTimer} large={true} />
            )}
            {currentStep?.measurement_parameters?.length > 0 && (
              <div style={{ marginBottom: 20, marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Record Measurements</div>
                {currentStep.measurement_parameters.map((param, pi) => {
                  const val = measurementValues[param.name] ?? '';
                  const numVal = parseFloat(val);
                  const outOfRange = val !== '' && !isNaN(numVal) && ((param.min_value != null && numVal < param.min_value) || (param.max_value != null && numVal > param.max_value));
                  return (
                    <div key={pi} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                        {param.name}{param.unit ? ` (${param.unit})` : ''}{param.required && <span style={{ color: '#ef4444' }}> *</span>}
                        {(param.min_value != null || param.max_value != null) && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}> Range: {param.min_value ?? '—'} – {param.max_value ?? '—'}</span>}
                      </label>
                      <input type="number" inputMode="decimal" value={val}
                        onChange={e => setMeasurementValues(p => ({ ...p, [param.name]: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                        placeholder={`Enter ${param.name}`}
                        style={{ width: '100%', padding: '14px 16px', background: outOfRange ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)', border: `1px solid ${outOfRange ? '#ef4444' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: 'white', fontSize: 18, fontWeight: 600, boxSizing: 'border-box', minHeight: 52 }} />
                      {outOfRange && <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>⚠ Out of range — Expected: {param.min_value ?? '—'} – {param.max_value ?? '—'} {param.unit || ''}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step Notes (optional)</label>
              <textarea value={stepNotes} onChange={e => setStepNotes(e.target.value)} placeholder="Add any observations..." rows={3}
                style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 14, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            {/* Steps overview accordion */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowStepsOverview(p => !p)}
                style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#64748b', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>View all steps ({mergedSteps?.length || 0})</span>
                <span>{showStepsOverview ? '▲' : '▼'}</span>
              </button>
              {showStepsOverview && (
                <div style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {mergedSteps.map((step, idx) => (
                    <div key={step.stepRunId || idx}
                      style={{ padding: '10px 14px', marginBottom: 4, background: idx === currentStepIndex ? 'rgba(99,102,241,0.2)' : step.step_state === 'completed' ? 'rgba(22,163,74,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${idx === currentStepIndex ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#64748b', width: 20, flexShrink: 0 }}>{step.step_order}.</span>
                        <span style={{ fontSize: 12, color: idx === currentStepIndex ? '#a5b4fc' : '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.instruction}</span>
                        {step.step_state === 'completed' && <span style={{ color: '#16a34a', fontSize: 12 }}>✓</span>}
                        {step.step_state === 'skipped' && <span style={{ color: '#f59e0b', fontSize: 12 }}>⏭</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fixed bottom action bar */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e293b', borderTop: '1px solid rgba(255,255,255,0.1)', padding: device.isMobile ? '12px 16px' : '16px 32px', display: 'flex', gap: 12, zIndex: 150, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <button onClick={() => setShowAbandon(true)} title="Abandon Run"
              style={{ padding: '0 16px', height: 56, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#fca5a5', fontSize: 20, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚠</button>
            {currentStepIndex > 0 && (
              <button onClick={() => setCurrentStepIndex(p => p - 1)}
                style={{ padding: '0 16px', height: 56, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>← Back</button>
            )}
            <button onClick={handleCompleteStep} disabled={completing}
              style={{ flex: 1, height: 56, background: completing ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: 12, color: 'white', fontSize: device.isMobile ? 15 : 16, fontWeight: 800, cursor: completing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
              {completing ? 'Saving...' : currentStepIndex >= (mergedSteps?.length || 1) - 1 ? '✓ Complete Run' : '✓ Complete Step'}
            </button>
          </div>

          {showAbandon && <AbandonRunModal onConfirm={handleAbandon} onCancel={() => setShowAbandon(false)} abandoning={abandoning} />}
        </div>
      ) : (
        /* ── DESKTOP LAYOUT ── */
        <div style={{ position: 'fixed', inset: 0, top: 52, background: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e293b', background: '#0f172a', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>RUN IN PROGRESS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Elapsed:</span>
                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#6366f1' }}>{fmtElapsed(runElapsed)}</span>
              </div>
            </div>
            <button onClick={() => setShowAbandon(true)} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Abandon Run</button>
          </div>
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {currentStep ? (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {currentStep.title && <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: 1, marginBottom: 6 }}>{currentStep.title.toUpperCase()}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Step {currentStep.step_order} of {mergedSteps.length}</span>
                      {currentStep.is_critical && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>⚠ Critical</span>}
                    </div>
                    <p style={{ fontSize: 18, lineHeight: 1.7, color: 'white', whiteSpace: 'pre-line', fontWeight: 400 }}>{currentStep.instruction}</p>
                  </div>
                  {currentStep.timing_mode !== 'none' && currentStep.expected_duration_seconds > 0 && (
                    <StepTimerBlock step={currentStep} timerState={timerState} elapsed={elapsed} onStart={handleStartTimer} onPause={handlePauseTimer} onRestart={handleRestartTimer} />
                  )}
                  {currentStep.measurement_parameters && currentStep.measurement_parameters.length > 0 && (
                    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '14px 18px', marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>📏 MEASUREMENTS</div>
                      {currentStep.measurement_parameters.map((param, i) => {
                        const val = measurementValues[param.name] ?? '';
                        const numVal = parseFloat(val);
                        const outOfRange = val !== '' && !isNaN(numVal) && ((param.min_value != null && numVal < param.min_value) || (param.max_value != null && numVal > param.max_value));
                        return (
                          <div key={i} style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>{param.name.toUpperCase()}{param.unit ? ` (${param.unit})` : ''}{param.required ? ' *' : ''}</label>
                            <input type="number" value={val} onChange={e => setMeasurementValues(p => ({ ...p, [param.name]: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                              style={{ width: '100%', padding: '10px 14px', background: outOfRange ? 'rgba(239,68,68,0.1)' : '#1e293b', border: `1px solid ${outOfRange ? '#ef4444' : '#334155'}`, borderRadius: 8, color: 'white', fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} placeholder="Enter value..." />
                            {(param.min_value != null || param.max_value != null) && <div style={{ fontSize: 11, color: outOfRange ? '#f87171' : '#64748b', marginTop: 4 }}>{outOfRange ? '⚠ Out of range — ' : ''}Expected: {param.min_value ?? '—'} – {param.max_value ?? '—'} {param.unit || ''}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 16, marginBottom: 20 }}>
                    <textarea value={stepNotes} onChange={e => setStepNotes(e.target.value)} placeholder="Step notes (optional)..."
                      style={{ width: '100%', minHeight: 72, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#94a3b8', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {currentStepIndex > 0 && <button onClick={() => setCurrentStepIndex(p => p - 1)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>← Previous</button>}
                    {!showSkipConfirm ? (
                      <button onClick={() => setShowSkipConfirm(true)} style={{ padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid #78350f', borderRadius: 8, color: '#f59e0b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>⏭ Skip Step</button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={handleSkipStep} style={{ padding: '10px 14px', background: '#78350f', border: 'none', borderRadius: 8, color: '#f59e0b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Confirm Skip</button>
                        <button onClick={() => setShowSkipConfirm(false)} style={{ padding: '10px 14px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                      </div>
                    )}
                    <button onClick={handleCompleteStep} disabled={completing}
                      style={{ flex: 1, padding: '12px 24px', background: completing ? '#3730a3' : '#6366f1', border: 'none', borderRadius: 8, color: 'white', cursor: completing ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {completing ? 'Saving...' : currentStepIndex >= mergedSteps.length - 1 ? '✓ Complete Run' : '✓ Complete Step'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 80, color: '#94a3b8' }}><p>All steps completed.</p></div>
              )}
            </div>
            {/* Right sidebar */}
            <div style={{ width: 280, background: '#0a0f1e', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>STEPS</div>
                <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{completedCount} / {mergedSteps.length} complete</div>
                <div style={{ height: 3, background: '#1e293b', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#6366f1', borderRadius: 99, width: `${mergedSteps.length > 0 ? (completedCount / mergedSteps.length) * 100 : 0}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {mergedSteps.map((step, index) => {
                  const prevStep = index > 0 ? mergedSteps[index - 1] : null;
                  const showTitleLabel = step.title && step.title !== prevStep?.title;
                  return (
                    <div key={step.stepRunId || step.id}>
                      {showTitleLabel && <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px 2px', opacity: 0.8 }}>{step.title}</div>}
                      <div onClick={() => (step.step_state === 'completed' || step.step_state === 'skipped') && setCurrentStepIndex(index)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: step.step_state === 'completed' || step.step_state === 'skipped' ? 'pointer' : 'default', background: index === currentStepIndex ? '#1e293b' : 'transparent', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, flexShrink: 0, color: step.step_state === 'completed' ? '#22c55e' : step.step_state === 'skipped' ? '#f59e0b' : index === currentStepIndex ? '#6366f1' : '#475569' }}>
                          {step.step_state === 'completed' ? '✓' : step.step_state === 'skipped' ? '⏭' : index === currentStepIndex ? '▶' : '●'}
                        </span>
                        <span style={{ flex: 1, fontSize: 11, color: index === currentStepIndex ? 'white' : step.step_state === 'completed' ? '#64748b' : '#94a3b8', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(step.instruction || '').substring(0, 45)}{(step.instruction || '').length > 45 ? '...' : ''}
                        </span>
                        <span style={{ fontSize: 9, color: '#475569', flexShrink: 0 }}>{step.step_order}</span>
                      </div>
                      {step.timing_mode !== 'none' && step.expected_duration_seconds > 0 && (
                        <div style={{ marginBottom: 2, marginLeft: 28 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: step.timing_mode === 'strict' ? '#fef2f2' : '#eff6ff', color: step.timing_mode === 'strict' ? '#dc2626' : '#1d4ed8', border: `1px solid ${step.timing_mode === 'strict' ? '#fecaca' : '#bfdbfe'}` }}>
                            {step.expected_duration_seconds >= 60 ? `${Math.floor(step.expected_duration_seconds / 60)}m` : `${step.expected_duration_seconds}s`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {showAbandon && <AbandonRunModal onConfirm={handleAbandon} onCancel={() => setShowAbandon(false)} abandoning={abandoning} />}
        </div>
      )}
    </>
  );
}