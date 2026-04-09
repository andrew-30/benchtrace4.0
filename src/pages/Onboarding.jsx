import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const TIMEZONES = ['UTC','Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid','Europe/Amsterdam','Europe/Stockholm','Europe/Warsaw','Europe/Zurich','Africa/Nairobi','Africa/Lagos','Africa/Cairo','Africa/Johannesburg','America/New_York','America/Chicago','America/Los_Angeles','America/Toronto','America/Sao_Paulo','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Asia/Shanghai','Australia/Sydney','Pacific/Auckland'];
const SECTORS = ['Academic Research','Clinical Diagnostic','GMP Manufacturing','ISO Accredited','CRO Study','Biotech Startup','General'];

const PERSONAS = [
  {
    id: 'starter',
    plan: 'starter',
    icon: '🎓',
    title: 'Individual Researcher',
    subtitle: 'PhD student, postdoc, or independent scientist',
    price: '$19',
    period: '/month',
    annual: '$15/mo billed annually',
    trial: '14-day free trial',
    trialDays: 14,
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
    defaultSector: 'Academic Research',
    features: [
      'Up to 5 protocols',
      '30 runs per month',
      'Protocol import (DOCX)',
      'Step timer control',
      'Deviation logging',
      'Basic PDF reports',
      'Lot number tracking',
      'Expiry warnings',
    ],
    notIncluded: [
      'Team members',
      '21 CFR Part 11 e-signature',
      'Traceability navigator',
    ],
    bestFor: 'Perfect for documenting your thesis research or personal lab work.',
  },
  {
    id: 'lab',
    plan: 'lab',
    icon: '🔬',
    title: 'Research Lab',
    subtitle: 'PI, lab manager, or small research team',
    price: '$79',
    period: '/month',
    annual: '$59/mo billed annually',
    trial: '21-day free trial',
    trialDays: 21,
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
    popular: true,
    defaultSector: 'Academic Research',
    features: [
      'Unlimited protocols',
      'Unlimited runs',
      'Up to 15 team members',
      'Team management + invites',
      'Role-based access control',
      'Traceability navigator',
      'Audit readiness score',
      'Advanced dashboard + charts',
      'Protocol version control',
      '2-year audit log retention',
    ],
    notIncluded: [
      '21 CFR Part 11 e-signature',
      'GMP compliance features',
    ],
    bestFor: 'Ideal for academic research groups and biotech teams needing collaboration.',
  },
  {
    id: 'lab_pro',
    plan: 'lab_pro',
    icon: '🏭',
    title: 'Regulated Environment',
    subtitle: 'GMP, clinical diagnostics, pharma, or CRO',
    price: '$249',
    period: '/month',
    annual: '$199/mo billed annually',
    trial: '30-day free trial',
    trialDays: 30,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    defaultSector: 'GMP Manufacturing',
    features: [
      'Everything in Lab +',
      'Unlimited team members',
      '21 CFR Part 11 e-signature',
      'SHA-256 cryptographic hash',
      'Inspector-ready Audit View',
      'Advanced PDF audit reports',
      'Deviation severity management',
      'Materials lot traceability',
      'Unlimited audit log retention',
      'Priority support',
    ],
    notIncluded: [],
    bestFor: 'Built for labs that need to pass FDA inspections and ISO audits.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState('persona');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [labName, setLabName] = useState('');
  const [sector, setSector] = useState('Academic Research');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  useEffect(() => {
    const init = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        const memberships = await base44.entities.OrganizationMembership.filter({ user_id: user.id });
        if (memberships && memberships.length > 0) {
          const membership = memberships[0];
          localStorage.setItem('bt_org_id', membership.organization_id);
          localStorage.setItem('bt_role', membership.role);
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch(e) { console.error('Onboarding init error:', e); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  function handleSelectPersona(persona) {
    setSelectedPersona(persona);
    setSector(persona.defaultSector);
    setScreen('features');
  }

  async function handleCreateLab() {
    if (!labName.trim()) { setError('Please enter your lab name.'); return; }
    setSaving(true); setError('');
    try {
      const now = new Date();
      const trialExpiry = new Date(now);
      trialExpiry.setDate(trialExpiry.getDate() + (selectedPersona?.trialDays || 14));

      const org = await base44.entities.Organization.create({
        name: labName.trim(),
        sector,
        timezone,
        plan: selectedPersona?.plan || 'starter',
        beta_user: true,
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpiry.toISOString(),
        created_by_id: currentUser.id,
      });

      await base44.entities.OrganizationMembership.create({
        organization_id: org.id,
        user_id: currentUser.id,
        role: 'admin',
        joined_at: now.toISOString(),
      });

      localStorage.setItem('bt_org_id', org.id);
      localStorage.setItem('bt_role', 'admin');
      localStorage.setItem('bt_tz', timezone);
      localStorage.setItem('bt_plan', selectedPersona?.plan || 'starter');

      navigate('/dashboard', { replace: true });
    } catch(e) {
      setError(e.message || 'Failed to create lab. Please try again.');
      setSaving(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ color:'#818cf8' }}>Loading...</div>
    </div>
  );

  // ─── SCREEN 1 — PERSONA SELECTOR ───────────────────────
  if (screen === 'persona') return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 20px', fontFamily:'system-ui,sans-serif', position:'relative' }}>

      <div style={{ position:'absolute', top:20, right:20, background:'rgba(99,102,241,0.3)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.5)', padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:700, letterSpacing:'0.1em' }}>BETA</div>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ width:40, height:40, background:'#6366f1', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(99,102,241,0.5)' }}>
          <span style={{ color:'white', fontSize:20, fontWeight:800 }}>B</span>
        </div>
        <span style={{ fontSize:22, fontWeight:900, color:'white' }}>BenchTrace</span>
        <span style={{ fontSize:11, fontWeight:700, color:'#818cf8', background:'rgba(99,102,241,0.2)', padding:'2px 8px', borderRadius:99 }}>4.0</span>
      </div>

      <h1 style={{ fontSize:28, fontWeight:900, color:'white', textAlign:'center', margin:'0 0 8px', maxWidth:560 }}>
        Which best describes you?
      </h1>
      <p style={{ fontSize:14, color:'#94a3b8', textAlign:'center', margin:'0 0 40px', maxWidth:440 }}>
        Choose your plan — all plans start with a free trial. No credit card required.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16, width:'100%', maxWidth:820, marginBottom:32 }}>
        {PERSONAS.map(persona => (
          <div
            key={persona.id}
            onClick={() => handleSelectPersona(persona)}
            style={{
              background:'rgba(255,255,255,0.06)',
              border:`2px solid ${persona.popular ? persona.border : 'rgba(255,255,255,0.1)'}`,
              borderRadius:14, padding:'24px 20px', cursor:'pointer',
              position:'relative', transition:'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {persona.popular && (
              <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#6366f1', color:'white', fontSize:10, fontWeight:800, padding:'3px 14px', borderRadius:99, letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
                ★ MOST POPULAR
              </div>
            )}

            <div style={{ fontSize:32, marginBottom:10 }}>{persona.icon}</div>
            <div style={{ fontSize:16, fontWeight:800, color:'white', marginBottom:4 }}>{persona.title}</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16, lineHeight:1.5 }}>{persona.subtitle}</div>

            <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
              <span style={{ fontSize:32, fontWeight:900, color:persona.color }}>{persona.price}</span>
              <span style={{ fontSize:13, color:'#64748b' }}>{persona.period}</span>
            </div>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:12 }}>{persona.annual}</div>

            <div style={{ display:'inline-block', padding:'4px 12px', background:`rgba(${persona.color === '#3b82f6' ? '59,130,246' : persona.color === '#6366f1' ? '99,102,241' : '220,38,38'},0.2)`, borderRadius:99, fontSize:11, fontWeight:700, color:persona.color, marginBottom:16, border:`1px solid ${persona.border}` }}>
              {persona.trial}
            </div>

            <div style={{ fontSize:11, color:'#94a3b8', lineHeight:1.6, marginBottom:16 }}>{persona.bestFor}</div>

            <div style={{ width:'100%', padding:'10px', background:persona.color, color:'white', borderRadius:8, fontSize:13, fontWeight:700, textAlign:'center' }}>
              Start {persona.trial} →
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding:'10px 20px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, fontSize:12, color:'#818cf8', textAlign:'center', maxWidth:500 }}>
        🎉 <strong>Beta users get full access free</strong> during our beta period. Pricing above applies after launch. Early adopters get 3 months free when we go live.
      </div>

      <div style={{ marginTop:12, fontSize:11, color:'#475569', textAlign:'center' }}>
        Signed in as {currentUser?.email}
      </div>
    </div>
  );

  // ─── SCREEN 2 — FEATURE LIST ────────────────────────────
  if (screen === 'features') {
    const persona = selectedPersona;
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 20px', fontFamily:'system-ui,sans-serif' }}>
        <div style={{ width:'100%', maxWidth:560 }}>
          <button onClick={() => setScreen('persona')} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:13, marginBottom:24, display:'flex', alignItems:'center', gap:6, padding:0 }}>
            ← Back to plans
          </button>

          <div style={{ background:'rgba(255,255,255,0.06)', border:`2px solid ${persona.border}`, borderRadius:14, padding:'24px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <span style={{ fontSize:28 }}>{persona.icon}</span>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'white' }}>{persona.title}</div>
                <div style={{ fontSize:13, color:'#94a3b8' }}>{persona.subtitle}</div>
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <div style={{ fontSize:24, fontWeight:900, color:persona.color }}>{persona.price}<span style={{ fontSize:13, color:'#64748b' }}>/mo</span></div>
                <div style={{ fontSize:10, color:'#64748b' }}>{persona.annual}</div>
              </div>
            </div>

            <div style={{ padding:'8px 14px', background:`rgba(${persona.color === '#3b82f6' ? '59,130,246' : persona.color === '#6366f1' ? '99,102,241' : '220,38,38'},0.15)`, borderRadius:8, fontSize:12, color:persona.color, fontWeight:600, marginBottom:16, border:`1px solid ${persona.border}` }}>
              ✓ {persona.trial} · Free during beta · No credit card required
            </div>

            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>What's included:</div>
            {persona.features.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ color:'#16a34a', fontWeight:700, fontSize:13, flexShrink:0 }}>✓</span>
                <span style={{ fontSize:13, color:'#e2e8f0' }}>{f}</span>
              </div>
            ))}

            {persona.notIncluded.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, marginTop:12 }}>Not included:</div>
                {persona.notIncluded.map((f, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ color:'#475569', fontSize:13, flexShrink:0 }}>✗</span>
                    <span style={{ fontSize:13, color:'#475569' }}>{f}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <button
            onClick={() => setScreen('setup')}
            style={{ width:'100%', padding:'14px', background:persona.color, color:'white', border:'none', borderRadius:10, fontSize:15, fontWeight:800, cursor:'pointer', marginBottom:12 }}
          >
            Set Up My Lab →
          </button>
          <button onClick={() => setScreen('persona')} style={{ width:'100%', padding:'10px', background:'transparent', color:'#64748b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, fontSize:13, cursor:'pointer' }}>
            View other plans
          </button>
        </div>
      </div>
    );
  }

  // ─── SCREEN 3 — LAB SETUP FORM ──────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'white', borderRadius:16, padding:'36px 40px', maxWidth:480, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>

        <button onClick={() => setScreen('features')} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:12, marginBottom:20, display:'flex', alignItems:'center', gap:6, padding:0 }}>
          ← Back
        </button>

        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:20 }}>{selectedPersona?.icon}</span>
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99, background:selectedPersona?.bg, color:selectedPersona?.color, border:`1px solid ${selectedPersona?.border}` }}>
              {selectedPersona?.title} · {selectedPersona?.trial}
            </span>
          </div>
          <h2 style={{ fontSize:20, fontWeight:800, color:'#1e293b', margin:'0 0 4px' }}>Set up your lab</h2>
          <p style={{ fontSize:13, color:'#64748b', margin:0 }}>
            Welcome{currentUser?.full_name ? `, ${currentUser.full_name}` : ''}. Just a few details to get you started.
          </p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Lab / Organisation Name *</label>
            <input
              value={labName}
              onChange={e => setLabName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateLab()}
              placeholder="e.g. Kisitu Research Lab"
              autoFocus
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${error && !labName ? '#ef4444' : '#e2e8f0'}`, borderRadius:8, fontSize:14, boxSizing:'border-box', fontFamily:'inherit' }}
            />
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Lab Sector</label>
            <select value={sector} onChange={e => setSector(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, background:'white', boxSizing:'border-box' }}>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, background:'white', boxSizing:'border-box' }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {error && (
            <div style={{ padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7, fontSize:12, color:'#dc2626' }}>{error}</div>
          )}

          <button
            onClick={handleCreateLab}
            disabled={saving || !labName.trim()}
            style={{ width:'100%', padding:'12px', background:saving || !labName.trim() ? '#94a3b8' : (selectedPersona?.color || '#6366f1'), color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:saving || !labName.trim() ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Creating your lab...' : `Start ${selectedPersona?.trial || '14-day trial'} →`}
          </button>

          <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', margin:0 }}>
            Free during beta · No credit card required · Signed in as {currentUser?.email}
          </p>
        </div>
      </div>
    </div>
  );
}