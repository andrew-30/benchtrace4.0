import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
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
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function handleSignOut() {
    localStorage.removeItem("bt_org_id");
    localStorage.removeItem("bt_role");
    base44.auth.logout("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border" style={{ position: 'relative' }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">BenchTrace</span>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe', letterSpacing: '0.08em' }}>BETA</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" label="Dashboard" />
            <NavLink to="/protocols" label="Protocols" />
            <NavLink to="/runs" label="Runs" />
            <NavLink to="/deviations" label="Deviations" />
            <NavLink to="/traceability" label="Traceability" />
            <NavLink to="/audit-readiness" label="Audit Readiness" />
            <NavLink to="/team" label="Team" />
            <NavLink to="/settings" label="Settings" />
          </nav>
        </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setMobileNavOpen(prev => !prev)} className="md:hidden"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#475569', fontSize: 20, display: 'flex', alignItems: 'center' }}>
              {mobileNavOpen ? '✕' : '☰'}
            </button>
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
      </div>

      {mobileNavOpen && (
        <div className="md:hidden" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, padding: '8px 0' }}>
          {[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Protocols', path: '/protocols' },
            { label: 'Runs', path: '/runs' },
            { label: 'Deviations', path: '/deviations' },
            { label: 'Traceability', path: '/traceability' },
            { label: 'Audit Readiness', path: '/audit-readiness' },
            localStorage.getItem('bt_role') === 'admin' ? { label: 'Team', path: '/team' } : null,
            { label: 'Settings', path: '/settings' },
          ].filter(Boolean).map(item => (
            <button key={item.path}
              onClick={() => { navigate(item.path); setMobileNavOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#1e293b', fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}