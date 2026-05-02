import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, Droplets,
  LineChart, Bell, Settings, LogOut, Menu, X, Calendar,
  User, Heart, Save, AlertCircle, CheckCircle, Loader2,
  Download, ArrowLeft, Stethoscope, Utensils,
  Target, Scale, Ruler, Cake, FileText, FileSpreadsheet,
  Info, Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PersonalInfo {
  name: string;
  email: string;
  age: string;
  weight: string;
  height: string;
  assignedDoctor: string;
}

interface HealthPreferences {
  targetGlucoseMin: string;
  targetGlucoseMax: string;
  dietaryRestrictions: string[];
}

interface NotificationSettings {
  emailAlerts: boolean;
  inAppAlerts: boolean;
  glucoseAlerts: boolean;
  doctorMessages: boolean;
}

const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard/patient",          active: false },
  { icon: Droplets,        label: "Glucose Logs", path: "/dashboard/patient/glucose",  active: false },
  { icon: Utensils,        label: "Meal Logs",    path: "/dashboard/patient/meals",    active: false },
  { icon: Sparkles,        label: "AI Assistant", path: "/dashboard/patient/ai-chat",  active: false },
  { icon: Settings,        label: "Settings",     path: "/dashboard/patient/settings", active: true },
];

const dietaryOptions = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut Allergies",
  "Low-Carb",
  "Keto",
  "Halal",
  "Kosher",
  "No Restrictions",
];

// ─── Toggle Switch Component ──────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between py-4">
      <div className="flex-1">
        <p className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>{label}</p>
        {description && <p className="text-slate-500 text-xs mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Success Toast ────────────────────────────────────────────────────────────
function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed top-20 right-5 z-50 bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300 ease-out">
      <CheckCircle className="w-5 h-5" />
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PatientSettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: user?.name || "John Doe",
    email: user?.email || "john.doe@example.com",
    age: "42",
    weight: "175",
    height: "5'10\"",
    assignedDoctor: "Dr. Sarah Chen, MD",
  });

  const [healthPreferences, setHealthPreferences] = useState<HealthPreferences>({
    targetGlucoseMin: "70",
    targetGlucoseMax: "140",
    dietaryRestrictions: ["Gluten-Free", "No Restrictions"],
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailAlerts: true,
    inAppAlerts: true,
    glucoseAlerts: true,
    doctorMessages: true,
  });

  const handleSignOut = () => { signOut(); navigate("/"); };

  const updatePersonalInfo = (field: keyof PersonalInfo, value: string) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));
  };

  const updateHealthPreferences = (field: keyof HealthPreferences, value: any) => {
    setHealthPreferences((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDietaryRestriction = (restriction: string) => {
    setHealthPreferences((prev) => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(restriction)
        ? prev.dietaryRestrictions.filter((r) => r !== restriction)
        : [...prev.dietaryRestrictions, restriction],
    }));
  };

  const updateNotification = (field: keyof NotificationSettings, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    await new Promise((r) => setTimeout(r, 1500));
    // In production, this would trigger a real CSV download
    const csvContent = "Date,Time,Glucose (mg/dL),Meal,Carbs (g)\n2026-04-30,07:30,112,Fasting,0\n2026-04-30,08:10,148,Oatmeal + fruit,65";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-data-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setExportingCSV(false);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    await new Promise((r) => setTimeout(r, 2000));
    // In production, this would generate and download a real PDF
    alert("PDF export complete! (In production, this would download a formatted PDF report)");
    setExportingPDF(false);
  };

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {/* Success Toast */}
      {showSuccess && (
        <SuccessToast
          message="Settings saved successfully!"
          onClose={() => setShowSuccess(false)}
        />
      )}

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
              Dia<span className="text-blue-600">Check</span>
            </span>
          </Link>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm" style={{ fontWeight: 700 }}>
              {user?.name?.charAt(0) ?? "P"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name}</p>
              <p className="text-slate-400 text-xs">Patient</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {sidebarNav.map(({ icon: Icon, label, active, badge, path }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              style={{ fontWeight: active ? 600 : 400 }}
              onClick={() => path && navigate(path)}
            >
              <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className="bg-red-500 text-white text-xs rounded-full w-[18px] h-[18px] flex items-center justify-center">{badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate("/dashboard/patient")}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            
          </div>
        </header>

        {/* Scrollable body */}
        <main className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Header */}
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-blue-600" strokeWidth={1.8} />
                </div>
                <div>
                  <h1 className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.02em" }}>
                    Profile & Settings
                  </h1>
                  <p className="text-slate-500 text-sm">Manage your personal health data and preferences</p>
                </div>
              </div>
            </div>

            {/* ── Section 1: Personal Information ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-slate-900" style={{ fontWeight: 700, fontSize: "1.1rem" }}>Personal Information</h2>
                  <p className="text-slate-400 text-xs">Update your basic profile details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Full Name</label>
                  <input
                    type="text"
                    value={personalInfo.name}
                    onChange={(e) => updatePersonalInfo("name", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Email Address</label>
                  <input
                    type="email"
                    value={personalInfo.email}
                    onChange={(e) => updatePersonalInfo("email", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
                    <Cake className="w-4 h-4 text-slate-400" />
                    Age
                  </label>
                  <input
                    type="number"
                    value={personalInfo.age}
                    onChange={(e) => updatePersonalInfo("age", e.target.value)}
                    min={1}
                    max={120}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
                    <Scale className="w-4 h-4 text-slate-400" />
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={personalInfo.weight}
                    onChange={(e) => updatePersonalInfo("weight", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
                    <Ruler className="w-4 h-4 text-slate-400" />
                    Height
                  </label>
                  <input
                    type="text"
                    value={personalInfo.height}
                    onChange={(e) => updatePersonalInfo("height", e.target.value)}
                    placeholder={`e.g. 5'10"`}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
                    <Stethoscope className="w-4 h-4 text-slate-400" />
                    Assigned Doctor
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={personalInfo.assignedDoctor}
                      readOnly
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 cursor-not-allowed text-sm"
                    />
                    <Info className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Contact admin to change assigned doctor</p>
                </div>
              </div>
            </div>

            {/* ── Section 2: Health Preferences ─────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Heart className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-slate-900" style={{ fontWeight: 700, fontSize: "1.1rem" }}>Health Preferences</h2>
                  <p className="text-slate-400 text-xs">Set your target ranges and dietary needs</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Target Glucose Range */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-3" style={{ fontWeight: 600 }}>
                    <Target className="w-4 h-4 text-slate-400" />
                    Target Glucose Range (mg/dL)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Minimum</p>
                      <input
                        type="number"
                        value={healthPreferences.targetGlucoseMin}
                        onChange={(e) => updateHealthPreferences("targetGlucoseMin", e.target.value)}
                        min={40}
                        max={200}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Maximum</p>
                      <input
                        type="number"
                        value={healthPreferences.targetGlucoseMax}
                        onChange={(e) => updateHealthPreferences("targetGlucoseMax", e.target.value)}
                        min={40}
                        max={300}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs text-emerald-800">
                      <strong>Current Target:</strong> {healthPreferences.targetGlucoseMin}–{healthPreferences.targetGlucoseMax} mg/dL
                      {" · "}Alerts will trigger outside this range
                    </p>
                  </div>
                </div>

                {/* Dietary Restrictions */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-3" style={{ fontWeight: 600 }}>
                    <Utensils className="w-4 h-4 text-slate-400" />
                    Dietary Restrictions
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {dietaryOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => toggleDietaryRestriction(option)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          healthPreferences.dietaryRestrictions.includes(option)
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {healthPreferences.dietaryRestrictions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {healthPreferences.dietaryRestrictions.map((restriction) => (
                        <span
                          key={restriction}
                          className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {restriction}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 3: Notification Settings ───────────────────────── */}
            

            {/* ── Section 4: Data Export ─────────────────────────────────── */}
            

            {/* ── Save Button ────────────────────────────────────────────── */}
            <div className="sticky bottom-0 bg-white rounded-2xl border border-slate-100 shadow-lg p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Remember to save your changes</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your preferences will be applied across the app
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all disabled:shadow-none whitespace-nowrap"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save All Changes
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}