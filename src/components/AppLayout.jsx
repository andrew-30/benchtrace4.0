import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";
import { setCurrentOrg } from "@/lib/planGate";
import { PlanContext, usePlanProvider } from "@/lib/PlanContext";

async function fixAbandonedRuns(orgId) {
  try {
    const abandonedRuns = await base44.entities.Run.filter({ organization_id: orgId, run_state: 'abandoned' });
    const broken = (abandonedRuns || []).filter(r => r.result_status === 'pending' || !r.result_status);
    if (broken.length > 0) {
      await Promise.all(broken.map(r => base44.entities.Run.update(r.id, { result_status: 'abandoned' })));
      console.log(`Fixed ${broken.length} abandoned runs`);
    }
  } catch(e) {
    console.error('fixAbandonedRuns failed:', e);
  }
}

async function migrateOrg(orgId) {
  try {
    const orgData = await base44.entities.Organization.filter({ id: orgId });
    const org = orgData?.[0];
    if (!org) return null;

    const now = new Date();
    const needsUpdate = {};

    const OLD_TO_NEW = { free: 'starter', pro: 'lab', team: 'lab', lab_pro: 'lab_pro' };
    if (OLD_TO_NEW[org.plan]) needsUpdate.plan = OLD_TO_NEW[org.plan];
    if (org.beta_user === undefined || org.beta_user === null) needsUpdate.beta_user = true;

    if (!org.trial_started_at) {
      needsUpdate.trial_started_at = now.toISOString();
      const TRIAL_DAYS = { starter: 14, lab: 21, lab_pro: 30 };
      const finalPlan = needsUpdate.plan || org.plan;
      const trialExpiry = new Date(now);
      trialExpiry.setDate(trialExpiry.getDate() + (TRIAL_DAYS[finalPlan] || 30));
      needsUpdate.trial_expires_at = trialExpiry.toISOString();
    }

    // Specific org overrides
    if (org.id === '69c1ff326cd36f01645372ec' && org.plan !== 'lab_pro') {
      needsUpdate.plan = 'lab_pro';
      const trialExpiry = new Date(now); trialExpiry.setDate(trialExpiry.getDate() + 30);
      needsUpdate.trial_expires_at = trialExpiry.toISOString();
      if (!org.trial_started_at) needsUpdate.trial_started_at = now.toISOString();
    }
    if (org.id === '69cfd70ade4b144683b02743' && org.plan !== 'lab_pro') {
      needsUpdate.plan = 'lab_pro';
      if (!org.trial_started_at) {
        needsUpdate.trial_started_at = now.toISOString();
        const trialExpiry = new Date(now); trialExpiry.setDate(trialExpiry.getDate() + 30);
        needsUpdate.trial_expires_at = trialExpiry.toISOString();
      }
    }
    if (org.id === '69cf8f74bdc9d94ebd59e9d3' && org.plan !== 'lab') {
      needsUpdate.plan = 'lab';
      if (!org.trial_started_at) {
        needsUpdate.trial_started_at = now.toISOString();
        const trialExpiry = new Date(now); trialExpiry.setDate(trialExpiry.getDate() + 21);
        needsUpdate.trial_expires_at = trialExpiry.toISOString();
      }
    }

    if (Object.keys(needsUpdate).length > 0) {
      await base44.entities.Organization.update(orgId, needsUpdate);
      return { ...org, ...needsUpdate };
    }
    return org;
  } catch(e) {
    console.error('Org migration failed:', e);
    return null;
  }
}

export default function AppLayout() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const planProvider = usePlanProvider();
  const { org, setOrg, loadOrg } = planProvider;

  // Preserve invite token to localStorage before any redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite_token');
    if (inviteToken) {
      localStorage.setItem('bt_pending_invite_token', inviteToken);
    }
  }, []);

  // Check for welcome message after invite acceptance (survives page reload)
  useEffect(() => {
    const welcomeMsg = localStorage.getItem('bt_welcome_message');
    if (welcomeMsg) {
      localStorage.removeItem('bt_welcome_message');
      setInviteSuccess(welcomeMsg);
      setTimeout(() => setInviteSuccess(''), 6000);
    }
  }, []);

  const handleInviteToken = async (currentUser) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const inviteToken = urlParams.get('invite_token');
      const storedToken = localStorage.getItem('bt_pending_invite_token');
      const token = inviteToken || storedToken;
      if (!token) return;

      // Clean up URL and localStorage immediately
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.removeItem('bt_pending_invite_token');

      const invites = await base44.entities.OrganizationInvite.filter({ token });
      const invite = invites?.[0];
      if (!invite) return;
      if (invite.status === 'revoked') return;

      if (invite.status === 'accepted') {
        if (invite.organization_id !== localStorage.getItem('bt_org_id')) {
          localStorage.setItem('bt_org_id', invite.organization_id);
          window.location.reload();
        }
        return;
      }

      // Check expiry (7 days)
      if (invite.created_at) {
        const diffDays = (Date.now() - new Date(invite.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return;
      }

      // Verify email matches
      if (currentUser.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
        setInviteError(`This invite was sent to ${invite.invited_email}. You are logged in as ${currentUser.email}.`);
        return;
      }

      // Create membership if not already a member
      const existingMemberships = await base44.entities.OrganizationMembership.filter({
        organization_id: invite.organization_id,
        user_id: currentUser.id,
      });
      if (!existingMemberships || existingMemberships.length === 0) {
        await base44.entities.OrganizationMembership.create({
          organization_id: invite.organization_id,
          user_id: currentUser.id,
          role: invite.invited_role || 'member',
          joined_at: new Date().toISOString(),
        });
      }

      await base44.entities.OrganizationInvite.update(invite.id, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      });

      await base44.entities.AuditLog.create({
        organization_id: invite.organization_id,
        event_type: 'team_member_joined',
        actor_user_id: currentUser.id,
        actor_email: currentUser.email,
        metadata: { role: invite.invited_role, invited_by: invite.invited_by_name },
        created_at: new Date().toISOString(),
      });

      localStorage.setItem('bt_org_id', invite.organization_id);
      localStorage.setItem('bt_role', invite.invited_role || 'member');

      // Get org name for welcome message
      let orgName = 'the team';
      try {
        const orgs = await base44.entities.Organization.filter({ id: invite.organization_id });
        orgName = orgs?.[0]?.name || 'the team';
      } catch(e) { /* use default */ }

      localStorage.setItem('bt_welcome_message', `Welcome to ${orgName} on BenchTrace!`);
      window.location.reload();
    } catch(e) {
      console.error('handleInviteToken failed:', e);
    }
  };

  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath.includes("onboarding")) return;

    const cachedOrgId = localStorage.getItem("bt_org_id");

    async function boot() {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Handle invite token before org loading
      await handleInviteToken(currentUser);

      if (cachedOrgId) {
        const org = await migrateOrg(cachedOrgId);
        setOrg(org);
        setCurrentOrg(org);
        await loadOrg();
        setRole(localStorage.getItem("bt_role"));
        if (org?.timezone) localStorage.setItem("bt_tz", org.timezone);
        localStorage.setItem("bt_plan", org?.plan || 'free');
        localStorage.setItem('bt_beta', org?.beta_user === true ? 'true' : 'false');
        fixAbandonedRuns(cachedOrgId);
        setLoading(false);
        if (location.pathname === "/") navigate("/dashboard", { replace: true });
        return;
      }

      const memberships = await base44.entities.OrganizationMembership.filter({
        user_id: currentUser.id,
      });

      if (!memberships || memberships.length === 0) {
        navigate("/onboarding", { replace: true });
        setLoading(false);
        return;
      }

      const membership = memberships[0];
      const orgData = await base44.entities.Organization.filter({
        id: membership.organization_id,
      });

      localStorage.setItem("bt_org_id", membership.organization_id);
      localStorage.setItem("bt_role", membership.role);

      const migratedOrg = await migrateOrg(membership.organization_id);
      if (migratedOrg?.timezone) localStorage.setItem("bt_tz", migratedOrg.timezone);
      localStorage.setItem("bt_plan", migratedOrg?.plan || 'free');
      localStorage.setItem('bt_beta', migratedOrg?.beta_user === true ? 'true' : 'false');
      setCurrentOrg(migratedOrg);
      setOrg(migratedOrg);
      await loadOrg();
      setRole(membership.role);
      setLoading(false);

      if (location.pathname === "/" || location.pathname === "/onboarding") {
        navigate("/dashboard", { replace: true });
      }
    }

    boot();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading BenchTrace...</p>
        </div>
      </div>
    );
  }

  return (
    <PlanContext.Provider value={planProvider}>
    <div className="min-h-screen bg-background">
      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input, select, textarea { font-size: 16px !important; }
        button { min-height: 36px; cursor: pointer; }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
          .page-container { padding: 12px 12px 80px !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .hide-mobile { display: none !important; }
          input, select, textarea { min-height: 44px !important; padding: 10px 12px !important; }
        }
        @media (min-width: 768px) {
          .mobile-bottom-nav { display: none !important; }
        }
        @media (min-width: 768px) and (max-width: 1199px) {
          .stat-grid { grid-template-columns: repeat(3, 1fr) !important; }
          input, select, textarea { min-height: 44px !important; }
          button { min-height: 44px !important; }
        }
        @media (hover: none) and (pointer: coarse) {
          button { min-height: 44px !important; min-width: 44px !important; }
        }
        @keyframes bt-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * {
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .two-col { grid-template-columns: 1fr !important; }
          .run-execution-sidebar { display: none !important; }
          .run-execution-main { width: 100% !important; }
          .page-content { padding: 16px 12px !important; }
        }
        @media (max-width: 480px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .quick-actions { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      <TopNav user={user} />
      {inviteSuccess && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'white', border: '2px solid #16a34a', borderRadius: 12, padding: '16px 24px', zIndex: 9999, fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', animation: 'slideDown 0.3s ease' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎉</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', marginBottom: 2 }}>{inviteSuccess}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>You can now access all team protocols and runs.</div>
          </div>
          <button onMouseDown={() => setInviteSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, marginLeft: 8, display: 'flex', alignItems: 'center', padding: '0 4px' }}>×</button>
        </div>
      )}
      <style>{`@keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
      {inviteError && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 10, padding: '14px 24px', zIndex: 500, fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 480 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{inviteError}</span>
          <button onMouseDown={() => setInviteError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, marginLeft: 8 }}>×</button>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet context={{ user, org, role, setOrg, setRole }} />
      </main>
    </div>
    </PlanContext.Provider>
  );
}