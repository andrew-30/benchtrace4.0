import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";

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
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath.includes("onboarding")) return;

    const cachedOrgId = localStorage.getItem("bt_org_id");

    async function boot() {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (cachedOrgId) {
        const org = await migrateOrg(cachedOrgId);
        setOrg(org);
        setRole(localStorage.getItem("bt_role"));
        if (org?.timezone) localStorage.setItem("bt_tz", org.timezone);
        if (org?.plan) localStorage.setItem("bt_plan", org.plan);
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
      if (migratedOrg?.plan) localStorage.setItem("bt_plan", migratedOrg.plan);

      setOrg(migratedOrg);
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
    <div className="min-h-screen bg-background">
      <style>{`
        * { box-sizing: border-box; }
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
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet context={{ user, org, role, setOrg, setRole }} />
      </main>
    </div>
  );
}