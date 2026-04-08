import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const SECTORS = ['Academic Research', 'Clinical Diagnostic', 'GMP Manufacturing', 'ISO Accredited', 'CRO Study', 'Biotech Startup', 'General'];
const TIMEZONES = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Zurich', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland'];
const PLANS = [
  { value: 'free', label: 'Free', desc: 'Up to 5 protocols, 20 runs/month' },
  { value: 'pro', label: 'Pro', desc: 'Unlimited protocols, 200 runs/month' },
  { value: 'team', label: 'Team', desc: 'Multiple users, unlimited runs' },
  { value: 'lab_pro', label: 'Lab Pro', desc: '21 CFR Part 11, advanced compliance' },
];

export default function Settings() {
  const orgId = localStorage.getItem('bt_org_id');
  const role = localStorage.getItem('bt_role');
  const isAdmin = role === 'admin';

  const [org, setOrg] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [sector, setSector] = useState('Academic Research');
  const [timezone, setTimezone] = useState('UTC');
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    async function load() {
      try {
        const [orgsData, currentUser] = await Promise.all([
          base44.entities.Organization.filter({ id: orgId }),
          base44.auth.me(),
        ]);
        const orgData = orgsData?.[0];
        if (orgData) {
          setOrg(orgData);
          setOrgName(orgData.name || '');
          setSector(orgData.sector || 'Academic Research');
          setTimezone(orgData.timezone || 'UTC');
          setPlan(orgData.plan || 'free');
        }
        setUser(currentUser);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    }
    if (orgId) load();
  }, [orgId]);

  async function handleSaveOrg() {
    if (!orgName.trim()) { setSaveError('Lab name is required.'); return; }
    setSaving(true); setSaveError(''); setSaveSuccess('');
    try {
      await base44.entities.Organization.update(org.id, {
        name: orgName.trim(),
        sector,
        timezone,
        plan,
      });
      localStorage.setItem('bt_tz', timezone);
      setOrg(prev => ({ ...prev, name: orgName.trim(), sector, timezone, plan }));
      setSaveSuccess('Lab settings saved successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch(e) {
      setSaveError('Failed to save. Please try again.');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
              {((user?.full_name || user?.email || '?')[0] || '?').toUpperCase()}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{user?.full_name || '—'}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{user?.email || '—'}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isAdmin ? '#eef2ff' : '#f1f5f9', color: isAdmin ? '#4338ca' : '#64748b', border: `1px solid ${isAdmin ? '#c7d2fe' : '#e2e8f0'}`, marginTop: 4, display: 'inline-block' }}>
              {(role || 'member').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Lab config */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Lab Configuration</div>

        {!isAdmin && (
          <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, marginBottom: 14, fontSize: 12, color: '#64748b' }}>
            👁 Only lab admins can modify these settings.
          </div>
        )}

        {saveSuccess && (
          <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, marginBottom: 14, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            ✓ {saveSuccess}
          </div>
        )}
        {saveError && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, marginBottom: 14, fontSize: 12, color: '#dc2626' }}>
            {saveError}
          </div>
        )}

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

      {/* Plan */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Current Plan</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {PLANS.map(p => (
            <div key={p.value} style={{ padding: '12px 14px', borderRadius: 8, border: `2px solid ${plan === p.value ? '#6366f1' : '#e2e8f0'}`, background: plan === p.value ? '#eef2ff' : '#f8fafc' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: plan === p.value ? '#4338ca' : '#1e293b', marginBottom: 3 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>{p.desc}</div>
              {plan === p.value && <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', marginTop: 5 }}>✓ Current plan</div>}
            </div>
          ))}
        </div>
      </div>

      {/* App info */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>About BenchTrace</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['Version', 'BenchTrace 4.0'],
            ['Build', 'Phase 6 — Production'],
            ['Compliance', '21 CFR Part 11 · GMP · ISO 17025'],
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