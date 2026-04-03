import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const SECTORS = [
  "Academic Research",
  "Clinical Diagnostic",
  "GMP Manufacturing",
  "ISO Accredited",
  "CRO Study",
  "Biotech Startup",
  "General",
];

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [labName, setLabName] = useState("");
  const [sector, setSector] = useState("Academic Research");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );

  useEffect(() => {
    async function init() {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        const memberships = await base44.entities.OrganizationMembership.filter({ user_id: user.id });
        if (memberships && memberships.length > 0) {
          const membership = memberships[0];
          localStorage.setItem("bt_org_id", membership.organization_id);
          localStorage.setItem("bt_role", membership.role);
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (e) {
        console.error("Onboarding init error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleSubmit() {
    if (!labName.trim()) {
      setError("Please enter your lab name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const org = await base44.entities.Organization.create({
        name: labName.trim(),
        sector,
        timezone,
        plan: "free",
        created_by_id: currentUser.id,
      });

      await base44.entities.OrganizationMembership.create({
        organization_id: org.id,
        user_id: currentUser.id,
        role: "admin",
        joined_at: new Date().toISOString(),
      });

      localStorage.setItem("bt_org_id", org.id);
      localStorage.setItem("bt_role", "admin");
      localStorage.setItem("bt_tz", timezone);

      navigate("/dashboard", { replace: true });
    } catch (e) {
      console.error("Onboarding error:", e);
      setError(e.message || "Failed to create lab. Please try again.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ color: "#6366f1", fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #f8fafc 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "white", borderRadius: 16, padding: "40px 48px",
        maxWidth: 520, width: "100%",
        boxShadow: "0 4px 24px rgba(99,102,241,0.08)",
        border: "1px solid #e0e7ff",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, background: "#6366f1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 20, fontWeight: 700 }}>B</span>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>BenchTrace</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "#eef2ff", padding: "2px 7px", borderRadius: 99 }}>4.0</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "12px 0 4px" }}>Set up your lab</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Welcome{currentUser?.full_name ? `, ${currentUser.full_name}` : ""}. Let's get your lab configured.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lab / Organisation Name *
            </label>
            <input
              value={labName}
              onChange={e => setLabName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. Molecular Biology Core"
              autoFocus
              style={{
                width: "100%", padding: "10px 14px",
                border: `1px solid ${error && !labName ? "#ef4444" : "#e2e8f0"}`,
                borderRadius: 8, fontSize: 15, boxSizing: "border-box",
                outline: "none", fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lab Sector
            </label>
            <select
              value={sector}
              onChange={e => setSector(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "white", fontFamily: "inherit" }}
            >
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "white", fontFamily: "inherit" }}
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !labName.trim()}
            style={{
              width: "100%", padding: "12px",
              background: saving || !labName.trim() ? "#94a3b8" : "#6366f1",
              color: "white", border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 700,
              cursor: saving || !labName.trim() ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {saving ? "Creating your lab..." : "Create Lab →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", margin: 0 }}>
            Signed in as {currentUser?.email}
          </p>
        </div>
      </div>
    </div>
  );
}