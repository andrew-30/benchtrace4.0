import { Link, useLocation } from "react-router-dom";
import { FlaskConical, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";

function NavLink({ to, label }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}

export default function TopNav({ user }) {
  function handleSignOut() {
    localStorage.removeItem("bt_org_id");
    localStorage.removeItem("bt_role");
    base44.auth.logout("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              BenchTrace 4.0
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" label="Dashboard" />
            <NavLink to="/protocols" label="Protocols" />
            <NavLink to="/runs" label="Runs" />
            <NavLink to="/deviations" label="Deviations" />
            <NavLink to="/traceability" label="Traceability" />
            <NavLink to="/audit-readiness" label="Audit Readiness" />
            <NavLink to="/settings" label="Settings" />
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-sm text-muted-foreground">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              {localStorage.getItem('bt_role') === 'admin' && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>ADMIN</span>
              )}
              {localStorage.getItem('bt_role') === 'member' && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>MEMBER</span>
              )}
              <span className="hidden sm:inline">{user?.email || "User"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-border px-4 py-2 flex gap-1 overflow-x-auto">
        <NavLink to="/dashboard" label="Dashboard" />
        <NavLink to="/protocols" label="Protocols" />
        <NavLink to="/runs" label="Runs" />
        <NavLink to="/deviations" label="Deviations" />
        <NavLink to="/traceability" label="Traceability" />
        <NavLink to="/audit-readiness" label="Audit Readiness" />
        <NavLink to="/settings" label="Settings" />
      </div>
    </header>
  );
}