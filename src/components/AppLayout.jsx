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
    async function boot() {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const memberships = await base44.entities.OrganizationMembership.filter({
        user_id: currentUser.id,
      });

      if (!memberships || memberships.length === 0) {
        if (location.pathname !== "/onboarding") {
          navigate("/onboarding", { replace: true });
        }
        setLoading(false);
        return;
      }

      const membership = memberships[0];
      const orgData = await base44.entities.Organization.filter({
        id: membership.organization_id,
      });

      const resolvedOrg = orgData?.[0] || null;

      localStorage.setItem("bt_org_id", membership.organization_id);
      localStorage.setItem("bt_role", membership.role);

      setOrg(resolvedOrg);
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

  const isOnboarding = location.pathname === "/onboarding";

  if (isOnboarding) {
    return <Outlet context={{ user, org, role, setOrg, setRole }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav user={user} />
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet context={{ user, org, role, setOrg, setRole }} />
      </main>
    </div>
  );
}