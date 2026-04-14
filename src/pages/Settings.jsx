import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import DismissibleNotification from "@/components/DismissibleNotification";
import { getPlanStatus } from "@/lib/planStatus";
import { PLAN_CONFIG } from "@/lib/planConfig";
import { GATE_PLAN_CONFIG } from "@/lib/planGate";

const SECTORS = ['Academic Research', 'Clinical Diagnostic', 'GMP Manufacturing', 'ISO Accredited', 'CRO Study', 'Biotech Startup', 'General'];
const TIMEZONES = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Zurich', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland'];
const PLANS = [
  { value: 'free', label: 'Free', desc: 'Up to 5 protocols, 20 runs/month' },
  { value: 'pro', label: 'Pro', desc: 'Unlimited protocols, 200 runs/month' },
  { value: 'team', label: 'Team', desc: 'Multiple users, unlimited runs' },
  { value: 'lab_pro', label: 'Lab Pro', desc: '21 CFR Part 11, advanced compliance' },
];

export default function Settings() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('bt_org_id');
  const role = localStorage.getItem('bt_role');
  const isAdmin = role === 'admin';

  const [org, setOrg] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  function showNotification(message, type = 'success') {
    setNotification({ message, type });
    if (type === 'success' || type === 'info') {
      setTimeout(() => setNotification(prev => prev?.message === message ? null : prev), 5000);
    }
  }

  const [orgName, setOrgName] = useState('');
  const [sector, setSector] = useState('Academic Research');
  const [timezone, setTimezone] = useState('UTC');
  const [previewPlan, setPreviewPlanState] = useState(() => {
    const stored = localStorage.getItem('bt_preview_plan');
    const actualPlan = localStorage.getItem('bt_plan') || 'starter';
    const validPlans = ['free', 'starter', 'lab', 'lab_pro'];
    return (stored && validPlans.includes(stored)) ? stored : actualPlan;
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        const storedOrgId = localStorage.getItem('bt_org_id');
        if (storedOrgId) {
          const orgs = await base44.entities.Organization.filter({ id: storedOrgId });
          const orgData = orgs?.[0];
          if (orgData) {
            setOrg(orgData);
            setOrgName(orgData.name || '');
            setSector(orgData.sector || 'Academic Research');
            setTimezone(orgData.timezone || 'UTC');
          }
        }
      } catch(e) {
        console.error('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  async function handleSaveOrg() {
    if (!orgName.trim()) { showNotification('Lab name is required.', 'error'); return; }
    setSaving(true);
    try {
      await base44.entities.Organization.update(org.id, {
        name: orgName.trim(),
        sector,
        timezone,
      });
      localStorage.setItem('bt_tz', timezone);
      setOrg(prev => ({ ...prev, name: orgName.trim(), sector, timezone }));
      showNotification('Lab settings saved successfully.', 'success');
    } catch(e) {
      showNotification('Failed to save. Please try again.', 'error');
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '8px 0' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Manage your lab configuration and account</p>
      </div>

      {/* Account info */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Account</div>
        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading account details...</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{user?.email || '—'}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isAdmin ? '#eef2ff' : '#f1f5f9', color: isAdmin ? '#4338ca' : '#64748b', border: `1px solid ${isAdmin ? '#c7d2fe' : '#e2e8f0'}`, display: 'inline-block' }}>
                {(role || 'member').toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Lab config */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Lab Configuration</div>

        {!isAdmin && (
          <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, marginBottom: 14, fontSize: 12, color: '#64748b' }}>
            👁 Only lab admins can modify these settings.
          </div>
        )}

        <DismissibleNotification
          message={notification?.message}
          type={notification?.type}
          onDismiss={() => setNotification(null)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lab / Organisation Name</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)} disabled={!isAdmin}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: !isAdmin ? '#f8fafc' : 'white', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sector</label>
              <select value={sector} onChange={e => setSector(e.target.value)} disabled={!isAdmin}
                style={{ width: '100%', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: !isAdmin ? '#f8fafc' : 'white', boxSizing: 'border-box' }}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} disabled={!isAdmin}
                style={{ width: '100%', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: !isAdmin ? '#f8fafc' : 'white', boxSizing: 'border-box' }}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveOrg} disabled={saving}
              style={{ padding: '9px 24px', background: saving ? '#94a3b8' : '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Beta Tester Plan Switcher */}
      {localStorage.getItem('bt_beta') === 'true' && (
        <div style={{
          padding: '20px', background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          borderRadius: 12, marginBottom: 20, border: '1px solid rgba(99,102,241,0.3)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a5b4fc' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Beta Tester Mode</span>
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>Preview Any Plan</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>
            Switch between plans to experience all BenchTrace features. No payment required during beta — real billing starts when beta ends.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { value: 'starter', name: 'Starter', price: '€19/mo', color: '#3b82f6', features: ['5 protocols', 'Basic runs', 'Deviation logging'] },
              { value: 'lab', name: 'Lab', price: '€79/mo', color: '#6366f1', features: ['20 protocols', 'AI Normaliser', 'Audit View', 'E-signature', 'Protocol versioning', 'Team (5 members)'] },
              { value: 'lab_pro', name: 'Lab Pro', price: '€249/mo', color: '#dc2626', features: ['Unlimited protocols', 'Audit Readiness', 'Traceability', 'Deviation Center', 'Unlimited team'] },
            ].map(plan => {
              const isSelected = previewPlan === plan.value;
              return (
                <button
                  key={plan.value}
                  onClick={() => {
                    localStorage.setItem('bt_preview_plan', plan.value);
                    setPreviewPlanState(plan.value);
                    setTimeout(() => window.location.reload(), 100);
                  }}
                  style={{
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                    border: `2px solid ${isSelected ? plan.color : 'rgba(255,255,255,0.1)'}`,
                    background: isSelected ? `${plan.color}20` : 'rgba(255,255,255,0.04)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isSelected ? 8 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: isSelected ? plan.color : 'rgba(255,255,255,0.2)', border: `2px solid ${isSelected ? plan.color : 'rgba(255,255,255,0.3)'}` }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{plan.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{plan.price}</span>
                      {isSelected && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: plan.color, color: 'white' }}>ACTIVE</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 20 }}>
                      {plan.features.map((f, i) => (
                        <span key={i} style={{ fontSize: 10, color: '#94a3b8', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>✓ {f}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.5 }}>
              ⚠ You are previewing <strong>{GATE_PLAN_CONFIG[previewPlan]?.name || previewPlan}</strong> features.
              Your actual plan is <strong>{GATE_PLAN_CONFIG[localStorage.getItem('bt_plan')]?.name || 'Starter'}</strong>.
              Switching reloads the page to apply changes.
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('bt_preview_plan', 'starter');
              window.location.reload();
            }}
            style={{
              width: '100%', marginTop: 10, padding: '8px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7, color: '#64748b', fontSize: 11,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            ↩ Reset to Starter (baseline view)
          </button>
        </div>
      )}

      {/* Plan */}
      {(() => {
        const planStatus = getPlanStatus(org);
        const planCfg = PLAN_CONFIG[planStatus.plan] || PLAN_CONFIG['starter'];
        const SETTINGS_PUNCHLINES = {
          starter: "Because 'I'll write it up later' has cost too many results.",
          lab: 'One protocol. Every run. Every person. Every time.',
          lab_pro: "Audit-ready isn't a goal. It's your default state.",
          free: "Because 'I'll write it up later' has cost too many results.",
          pro: 'One protocol. Every run. Every person. Every time.',
          team: 'One protocol. Every run. Every person. Every time.',
        };
        return (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Current Plan</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>{planCfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{planCfg.name}</span>
                  {planStatus.isBeta && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe' }}>BETA</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {planStatus.isBeta
                    ? 'Free during beta · All features unlocked'
                    : planStatus.trialExpired
                    ? 'Trial ended'
                    : planStatus.hasTrial
                    ? `Trial · ${planStatus.daysLeft} day${planStatus.daysLeft !== 1 ? 's' : ''} remaining`
                    : 'Active'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: planCfg.color }}>
                  {planStatus.isBeta ? 'Free' : `$${planCfg.price}/mo`}
                </div>
                {!planStatus.isBeta && (
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>or ${planCfg.annualPrice}/mo annual</div>
                )}
              </div>
            </div>

            {SETTINGS_PUNCHLINES[planStatus.plan] && (
              <div style={{ fontSize:12, fontStyle:'italic', color: planCfg.color, lineHeight:1.5, marginBottom:14, padding:'8px 12px', background: planCfg.bg, border:`1px solid ${planCfg.border}`, borderLeft:`3px solid ${planCfg.color}`, borderRadius:6 }}>
                "{SETTINGS_PUNCHLINES[planStatus.plan]}"
              </div>
            )}

            {planStatus.hasTrial && !planStatus.isBeta && !planStatus.trialExpired && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Trial progress</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: planStatus.urgentRenewal ? '#dc2626' : '#64748b' }}>
                    {planStatus.daysLeft} day{planStatus.daysLeft !== 1 ? 's' : ''} left
                  </span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: planStatus.urgentRenewal ? '#dc2626' : planCfg.color, width: `${planStatus.trialProgressPct}%` }} />
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                  Trial ends {new Date(org?.trial_expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}

            {planStatus.isBeta && (
              <div style={{ padding: '8px 12px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 12, color: '#4338ca', marginBottom: 14 }}>
                🎉 You have full access during our beta period. Pricing applies after launch — early adopters get 3 months free.
              </div>
            )}

            {planStatus.trialExpired && !planStatus.isBeta && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
                ⚠ Your trial has ended. Upgrade to continue creating protocols and runs.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/pricing')}
                style={{ flex: 1, padding: '8px', background: planCfg.color, color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                {planStatus.trialExpired ? 'Upgrade Now →' : 'View All Plans →'}
              </button>
              {!planStatus.trialExpired && (
                <button
                  onClick={() => navigate('/pricing')}
                  style={{ padding: '8px 16px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}
                >
                  Compare Plans
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* App info */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>About BenchTrace</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['Version', 'BenchTrace 4.0'],
            ['Build', 'Phase 6 — Production'],
            ['Compliance', '21 CFR Part 11 · GMP · ISO 17025'],
            ['Account', user?.email || '—'],
            ['Organisation ID', orgId?.slice(-12) || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: '#94a3b8', width: 110, flexShrink: 0 }}>{k}</span>
              <span style={{ color: '#475569', fontFamily: k === 'Organisation ID' ? 'monospace' : 'inherit' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}