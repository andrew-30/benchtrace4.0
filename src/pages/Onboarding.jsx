import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function Onboarding() {
  const { user, setOrg, setRole } = useOutletContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("Academic Research");
  const [timezone, setTimezone] = useState("UTC");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);

    const org = await base44.entities.Organization.create({
      name: name.trim(),
      sector,
      timezone,
      plan: "free",
      created_by_id: user.id,
    });

    await base44.entities.OrganizationMembership.create({
      organization_id: org.id,
      user_id: user.id,
      role: "admin",
      joined_at: new Date().toISOString(),
    });

    localStorage.setItem("bt_org_id", org.id);
    localStorage.setItem("bt_role", "admin");

    setOrg(org);
    setRole("admin");
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <FlaskConical className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to BenchTrace 4.0
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Set up your lab to start building and executing protocols.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="labName">Lab Name</Label>
              <Input
                id="labName"
                placeholder="e.g. Molecular Biology Core"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Sector</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !name.trim()}>
              {submitting ? "Creating..." : "Create My Lab"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}