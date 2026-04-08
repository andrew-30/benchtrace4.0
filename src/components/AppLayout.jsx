import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";

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
        const orgData = await base44.entities.Organization.filter({ id: cachedOrgId });
        const org = orgData?.[0] || null;
        setOrg(org);
        setRole(localStorage.getItem("bt_role"));
        if (org?.timezone) localStorage.setItem("bt_tz", org.timezone);
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
      if (orgData?.[0]?.timezone) localStorage.setItem("bt_tz", orgData[0].timezone);

      setOrg(orgData?.[0] || null);
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