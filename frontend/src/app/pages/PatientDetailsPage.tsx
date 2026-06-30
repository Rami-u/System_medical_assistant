import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, Users, LogOut, Menu, X, Sparkles,
  Search, Stethoscope, Bell, ChevronRight,
  Droplets, Calendar, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Phone, Mail,
  User, Heart, Utensils, Clock,
  FileText, Send, Loader2, Plus, Trash2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { doctorApi } from "../../api/doctorApi";

// ─── API Types ───────────────────────────────────────────────────────────────────
interface PatientListInfo {
  patient_id: number;
  full_name: string;
  patient_code: string;
  diabetes_type: string;
  risk_level: "high" | "moderate" | "low";
  last_visit: string;
  avg_glucose: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const riskConfig = {
  high:     { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   dot: "bg-red-500",    label: "High Risk" },
  moderate: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", dot: "bg-amber-500",  label: "Moderate" },
  low:      { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot:"bg-emerald-500",label: "Low Risk" },
};

// ─── Glucose tooltip ─────────────────────────────────────────────────────────
const GlucoseTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val >= 126 ? "#ef4444" : val < 70 ? "#3b82f6" : "#10b981";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{val} <span className="font-normal text-slate-400">mg/dL</span></p>
    </div>
  );
};

const GenericTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-slate-900 text-sm font-bold">{payload[0].value} <span className="font-normal text-slate-400">{unit}</span></p>
    </div>
  );
};

// ─── Write Note Modal ─────────────────────────────────────────────────────────
function WriteNoteModal({
  patient,
  onClose,
  onSave,
}: {
  patient: { id: number; name: string };
  onClose: () => void;
  onSave: (note: any) => void;
}) {
  const [text,     setText]     = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent" | "critical">("routine");
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 700));
    const note = await doctorApi.createNote(patient.id, text.trim(), priority);
    onSave(note);
    setSaving(false);
    onClose();
  };

  const priorityConfig = {
    routine:  { bg: "border-slate-200 bg-slate-50 text-slate-700",     active: "border-blue-500 bg-blue-50 text-blue-700"    },
    urgent:   { bg: "border-slate-200 bg-slate-50 text-slate-700",     active: "border-amber-500 bg-amber-50 text-amber-700" },
    critical: { bg: "border-slate-200 bg-slate-50 text-slate-700",     active: "border-red-500 bg-red-50 text-red-700"       },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Write Clinical Note</h3>
              <p className="text-slate-400 text-xs mt-0.5">Visible to {patient.name} immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Priority */}
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Priority Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(["routine", "urgent", "critical"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2.5 rounded-xl border text-xs capitalize transition-all ${priority === p ? priorityConfig[p].active : priorityConfig[p].bg}`}
                  style={{ fontWeight: priority === p ? 600 : 400 }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Note text */}
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
              Clinical Note
              <span className="text-slate-400 font-normal ml-2">(will appear on patient dashboard)</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`e.g. Your glucose readings have been consistently high this week. Please increase water intake, avoid high-carb meals, and ensure you're taking Metformin with food. Schedule a follow-up in 2 weeks.`}
              rows={5}
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm resize-none"
            />
            <p className="text-slate-400 text-xs mt-1.5">{text.length} characters</p>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.8} />
            <p className="text-blue-700 text-xs leading-relaxed">
              This note will be <strong>instantly visible</strong> on the patient's dashboard. Make sure your message is clear and actionable.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
              : <><Send className="w-4 h-4" />Send Note to Patient</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Patient List Card ────────────────────────────────────────────────────────
function PatientCard({ patient, selected, onClick }: { patient: PatientListInfo; selected: boolean; onClick: () => void }) {
  const risk = riskConfig[patient.risk_level] || riskConfig.moderate;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
        selected
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
          {patient.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm truncate ${selected ? "text-blue-900" : "text-slate-900"}`} style={{ fontWeight: 700 }}>
              {patient.full_name}
            </p>
            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? "text-blue-400" : "text-slate-300"}`} />
          </div>
          <p className="text-slate-400 text-xs mb-2">{patient.patient_code} · {patient.diabetes_type}</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${risk.bg} ${risk.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
              {risk.label}
            </span>
            <span className="text-slate-300 text-xs">{patient.last_visit}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PatientDetailsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patientsList, setPatientsList] = useState<PatientListInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "moderate" | "low">("all");
  const [logsTab, setLogsTab] = useState<"glucose" | "meal">("glucose");
  const [showWriteNote, setShowWriteNote] = useState(false);

useEffect(() => {
    const fetchPatients = async () => {
        try {
            const res = await doctorApi.getPatients(riskFilter === "all" ? undefined : riskFilter, search);
            setPatientsList(res.patients);
            if (res.patients.length > 0 && !selectedPatientId) {
                setSelectedPatientId(res.patients[0].patient_id);
            } else if (res.patients.length === 0) {
                setProfile(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    const timeout = setTimeout(fetchPatients, 300);
    return () => clearTimeout(timeout);
}, [search, riskFilter]);

useEffect(() => {
    if (!selectedPatientId) return;
    const fetchProfile = async () => {
        setLoadingProfile(true);
        try {
            const res = await doctorApi.getPatientProfile(selectedPatientId);
            setProfile(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingProfile(false);
        }
    };
    fetchProfile();
}, [selectedPatientId]);

  const handleSaveNote = (note: any) => {
    setProfile((prev: any) => ({
      ...prev,
      clinical_notes: [note, ...prev.clinical_notes]
    }));
  };

  const handleSignOut = () => { signOut(); navigate("/"); };

  const p = profile;

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
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

        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name || "Dr. Sarah Chen"}</p>
              <p className="text-slate-400 text-xs">Physician</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {[
            { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/doctor", active: false },
            { icon: Users, label: "Patients", path: "/dashboard/doctor/patients", active: true },
            { icon: Sparkles, label: "AI Chat", path: "/dashboard/doctor/ai-chat", active: false },
          ].map(({ icon: Icon, label, active, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </nav>

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
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span style={{ fontWeight: 600 }}>Patient Records</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">{patientsList.length} patients</span>
          </div>
          <button onClick={() => navigate("/dashboard/doctor")} className="flex items-center gap-2 text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Alerts</span>
          </button>
        </header>

        {/* Body: list + detail */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Patient List Panel ────────────────────────────────────────── */}
          <div className="w-72 xl:w-80 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden hidden md:flex">
            {/* Search + Filter */}
            <div className="px-4 py-4 border-b border-slate-50 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search patients..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "high", "moderate", "low"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRiskFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      riskFilter === r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {loading ? (
                <div className="text-center py-8 text-slate-400 text-sm flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
                </div>
              ) : patientsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No patients found</div>
              ) : (
                patientsList.map(patient => (
                  <PatientCard
                    key={patient.patient_id}
                    patient={patient}
                    selected={selectedPatientId === patient.patient_id}
                    onClick={() => { setSelectedPatientId(patient.patient_id); setLogsTab("glucose"); }}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Detail Panel ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            {!selectedPatientId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                Select a patient to view details
              </div>
            ) : loadingProfile || !p ? (
               <div className="flex h-full items-center justify-center">
                 <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
               </div>
            ) : (
            <>
            {/* ── Patient Header ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl flex-shrink-0" style={{ fontWeight: 800 }}>
                  {p.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h1 className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.3rem" }}>{p.full_name}</h1>
                      <p className="text-slate-400 text-sm mt-0.5">{p.patient_code} · {p.age || "?"} yrs · {p.gender || "?"} · Born {p.dob || "?"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${riskConfig[p.stats.risk_level as keyof typeof riskConfig]?.bg || "bg-slate-50"} ${riskConfig[p.stats.risk_level as keyof typeof riskConfig]?.text || "text-slate-700"} ${riskConfig[p.stats.risk_level as keyof typeof riskConfig]?.border || "border-slate-200"} border`}>
                        <span className={`w-2 h-2 rounded-full ${riskConfig[p.stats.risk_level as keyof typeof riskConfig]?.dot || "bg-slate-400"}`} />
                        {riskConfig[p.stats.risk_level as keyof typeof riskConfig]?.label || "Unknown Risk"}
                      </span>
                      <button
                        onClick={() => setShowWriteNote(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Write Note
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{p.email || "No email"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Key Metrics ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Avg Glucose",
                  value: p.stats.avg_glucose || "-",
                  unit: "mg/dL",
                  icon: Droplets,
                  color: (p.stats.avg_glucose || 0) >= 126 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : { bg: "bg-blue-50", icon: "text-blue-500", val: "text-blue-700" },
                },
                {
                  label: "Latest Glucose",
                  value: p.stats.last_glucose || "-",
                  unit: "mg/dL",
                  icon: Activity,
                  color: (p.stats.last_glucose || 0) >= 126 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : (p.stats.last_glucose || 0) < 70 ? { bg: "bg-amber-50", icon: "text-amber-500", val: "text-amber-700" } : { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700" },
                },
                {
                  label: "HbA1c",
                  value: p.stats.hba1c || "-",
                  unit: "%",
                  icon: Heart,
                  color: (p.stats.hba1c || 0) >= 8 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : (p.stats.hba1c || 0) >= 6.5 ? { bg: "bg-amber-50", icon: "text-amber-500", val: "text-amber-700" } : { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700" },
                },
                {
                  label: "BMI",
                  value: p.physical.bmi || "-",
                  unit: "kg/m²",
                  icon: User,
                  color: (p.physical.bmi || 0) >= 30 ? { bg: "bg-red-50", icon: "text-red-500", val: "text-red-700" } : (p.physical.bmi || 0) >= 25 ? { bg: "bg-amber-50", icon: "text-amber-500", val: "text-amber-700" } : { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700" },
                },
              ].map(({ label, value, unit, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                  <div className={`w-9 h-9 ${color.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-4.5 h-4.5 ${color.icon}`} strokeWidth={1.8} />
                  </div>
                  <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                  <p className={`${color.val}`} style={{ fontWeight: 800, fontSize: "1.5rem", lineHeight: 1 }}>{value}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{unit}</p>
                </div>
              ))}
            </div>

            {/* ── Physical Info ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-900 text-sm mb-4" style={{ fontWeight: 700 }}>Physical Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Height",    value: p.physical.height_cm ? `${p.physical.height_cm} cm` : "-" },
                  { label: "Weight",    value: p.physical.weight_kg ? `${p.physical.weight_kg} kg` : "-" },
                  { label: "BMI",       value: p.physical.bmi || "-"            },
                  { label: "Diagnosis", value: p.physical.diabetes_type      },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                    <p className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Health Preferences ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-900 text-sm mb-4" style={{ fontWeight: 700 }}>Health Preferences</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Glucose Target",  value: p.preferences ? `${p.preferences.min_glucose} – ${p.preferences.max_glucose} mg/dL` : "70 – 140 mg/dL" },
                  { label: "Carb Limit",      value: p.preferences?.carb_limit_g ? `${p.preferences.carb_limit_g}g` : "-" },
                  { label: "Diet Type",       value: p.preferences?.diet_type || "Standard" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                    <p className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Clinical Notes ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" strokeWidth={1.8} />
                  <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Clinical Notes</h3>
                  {p.clinical_notes.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">{p.clinical_notes.length}</span>
                  )}
                </div>
                <button
                  onClick={() => setShowWriteNote(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />Add Note
                </button>
              </div>

              {p.clinical_notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                    <FileText className="w-5 h-5 text-slate-300" strokeWidth={1.8} />
                  </div>
                  <p className="text-slate-500 text-sm" style={{ fontWeight: 600 }}>No notes yet</p>
                  <p className="text-slate-400 text-xs mt-1">Clinical notes you write will appear here and on the patient's dashboard.</p>
                  <button
                    onClick={() => setShowWriteNote(true)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />Write First Note
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {p.clinical_notes.map((note: any) => {
                    const priorityCfg = {
                      routine:  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-100",   dot: "bg-blue-500"   },
                      urgent:   { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-100",  dot: "bg-amber-500"  },
                      critical: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-100",    dot: "bg-red-500"    },
                    }[note.priority as "routine"|"urgent"|"critical"] || { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", dot: "bg-blue-500" };
                    return (
                      <div key={note.note_id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${priorityCfg.bg}`}>
                              <FileText className={`w-3.5 h-3.5 ${priorityCfg.text}`} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border capitalize font-semibold ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />{note.priority}
                                </span>
                                <span className="text-slate-400 text-xs">{note.doctor_name}</span>
                                <span className="text-slate-300 text-xs">·</span>
                                <span className="text-slate-400 text-xs flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />{new Date(note.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-slate-700 text-sm leading-relaxed">{note.note_text}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Glucose Trend Chart ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Glucose Trend</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Last 14 days · mg/dL</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Normal</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />High</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={p.glucose_trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[40, 280]} />
                  <Tooltip content={<GlucoseTooltip />} />
                  <ReferenceLine y={126} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "High", position: "right", fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={70} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Low", position: "right", fontSize: 9, fill: "#3b82f6" }} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const color = payload.avg >= 126 ? "#ef4444" : payload.avg < 70 ? "#3b82f6" : "#10b981";
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill={color} stroke="white" strokeWidth={1.5} />;
                    }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Weekly Avg + Meal Carbs ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Weekly Average */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-slate-900 text-sm mb-1" style={{ fontWeight: 700 }}>Weekly Average Glucose</h3>
                <p className="text-slate-400 text-xs mb-5">Last 4 weeks · mg/dL</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={p.weekly_avg_glucose} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[60, 250]} />
                    <Tooltip content={<GenericTooltip unit="mg/dL" />} />
                    <ReferenceLine y={126} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {p.weekly_avg_glucose.map((entry: any, i: number) => {
                        const color = entry.avg >= 180 ? "#ef4444" : entry.avg >= 126 ? "#f59e0b" : "#10b981";
                        return <Cell key={`cell-${i}`} fill={color} fillOpacity={0.85} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Meal Carbs */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-slate-900 text-sm mb-1" style={{ fontWeight: 700 }}>Daily Carb Intake</h3>
                <p className="text-slate-400 text-xs mb-5">Last 7 days · grams</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={p.daily_carb_intake} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 130]} />
                    <Tooltip content={<GenericTooltip unit="g" />} />
                    <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Target", position: "right", fontSize: 9, fill: "#10b981" }} />
                    <Bar dataKey="total_carbs" fill="#10b981" fillOpacity={0.8} radius={[6, 6, 0, 0]}>
                      {p.daily_carb_intake.map((entry: any, i: number) => (
                        <Cell key={`meal-${i}`} fill={entry.total_carbs > 75 ? "#f59e0b" : "#10b981"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── HbA1c History ── */}
            

            {/* ── Glucose & Meal Logs History ────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Tab Header */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setLogsTab("glucose")}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 text-sm transition-all border-b-2 ${
                    logsTab === "glucose"
                      ? "border-blue-600 text-blue-700 bg-blue-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: logsTab === "glucose" ? 600 : 400 }}
                >
                  <Droplets className="w-4 h-4" strokeWidth={1.8} />
                  Glucose Logs
                  <span className={`text-xs px-2 py-0.5 rounded-full ${logsTab === "glucose" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                    {p.glucose_logs.length}
                  </span>
                </button>
                <button
                  onClick={() => setLogsTab("meal")}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 text-sm transition-all border-b-2 ${
                    logsTab === "meal"
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: logsTab === "meal" ? 600 : 400 }}
                >
                  <Utensils className="w-4 h-4" strokeWidth={1.8} />
                  Meal Logs
                  <span className={`text-xs px-2 py-0.5 rounded-full ${logsTab === "meal" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {p.meal_logs.length}
                  </span>
                </button>
              </div>

              {/* Column Headers */}
              {logsTab === "glucose" ? (
                <>
                  <div className="grid grid-cols-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-400" style={{ fontWeight: 600 }}>
                    <span>Date & Time</span>
                    <span>Value</span>
                    <span>Context</span>
                    <span>Notes</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                    {p.glucose_logs.map((log: any) => {
                      const isHigh = log.glucose_value >= 126;
                      const isLow  = log.glucose_value < 70;
                      const valColor  = isHigh ? "text-red-700"     : isLow ? "text-blue-700"     : "text-emerald-700";
                      const badgeCls  = isHigh ? "bg-red-50 text-red-600 border border-red-100"
                                      : isLow  ? "bg-blue-50 text-blue-600 border border-blue-100"
                                               : "bg-emerald-50 text-emerald-600 border border-emerald-100";
                      const ctxColors: Record<string, string> = {
                        "fasting":      "bg-blue-50 text-blue-700",
                        "after-meal":   "bg-amber-50 text-amber-700",
                        "before-sleep": "bg-purple-50 text-purple-700",
                        "random":       "bg-slate-100 text-slate-600",
                      };
                      const dt = new Date(log.recorded_at);
                      return (
                        <div key={log.id} className="grid grid-cols-4 items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Droplets className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.8} />
                            </div>
                            <div>
                              <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{dt.toLocaleDateString()}</p>
                              <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />{dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className={`text-sm ${valColor}`} style={{ fontWeight: 700 }}>{log.glucose_value}</span>
                            <span className="text-slate-400 text-xs ml-1">mg/dL</span>
                            <div className="mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${badgeCls}`} style={{ fontWeight: 600 }}>
                                {isHigh ? "High" : isLow ? "Low" : "Normal"}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className={`text-xs px-2 py-1 rounded-lg capitalize ${ctxColors[(log.reading_type || 'random')] || "bg-slate-100 text-slate-600"}`} style={{ fontWeight: 500 }}>
                              {(log.reading_type || 'random').replace("-", " ")}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs truncate">{log.notes || <span className="text-slate-200">—</span>}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-400" style={{ fontWeight: 600 }}>
                    <span>Date & Time</span>
                    <span className="col-span-2">Meal</span>
                    <span>Carbs</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                    {p.meal_logs.map((log: any) => {
                      const isOver  = (log.total_carbs_g || 0) > 75;
                      const carbColor = isOver ? "text-amber-700" : "text-emerald-700";
                      const carbBadge = isOver ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100";
                      const typeColors: Record<string, string> = {
                        breakfast: "bg-orange-50 text-orange-700",
                        lunch:     "bg-sky-50 text-sky-700",
                        dinner:    "bg-indigo-50 text-indigo-700",
                        snack:     "bg-pink-50 text-pink-700",
                      };
                      const dt = new Date(log.meal_time);
                      return (
                        <div key={log.id} className="grid grid-cols-4 items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Utensils className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                            </div>
                            <div>
                              <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{dt.toLocaleDateString()}</p>
                              <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />{dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <div className="col-span-2 pr-2">
                            <p className="text-slate-800 text-sm truncate" style={{ fontWeight: 500 }}>{log.meal_name || "Unknown Meal"}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-lg mt-0.5 inline-block capitalize bg-slate-100`} style={{ fontWeight: 500 }}>
                              Meal
                            </span>
                          </div>
                          <div>
                            <span className={`text-sm ${carbColor}`} style={{ fontWeight: 700 }}>{log.total_carbs_g ?? 0}g</span>
                            <div className="mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${carbBadge}`} style={{ fontWeight: 600 }}>
                                {isOver ? "Over target" : "On target"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Footer summary */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                {logsTab === "glucose" ? (
                  <>
                    <p className="text-slate-400 text-xs">
                      {p.glucose_logs.length} readings · Avg{" "}
                      <span className="text-slate-700 font-semibold">
                        {p.glucose_logs.length > 0 ? Math.round(p.glucose_logs.reduce((s: number, l: any) => s + l.glucose_value, 0) / p.glucose_logs.length) : 0} mg/dL
                      </span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      In range:{" "}
                      <span className="text-emerald-600 font-semibold">
                        {p.glucose_logs.length > 0 ? Math.round((p.glucose_logs.filter((l: any) => l.glucose_value >= 70 && l.glucose_value < 126).length / p.glucose_logs.length) * 100) : 0}%
                      </span>
                      {" "}· High:{" "}
                      <span className="text-red-600 font-semibold">
                        {p.glucose_logs.length > 0 ? Math.round((p.glucose_logs.filter((l: any) => l.glucose_value >= 126).length / p.glucose_logs.length) * 100) : 0}%
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 text-xs">
                      {p.meal_logs.length} meals logged · Avg carbs{" "}
                      <span className="text-slate-700 font-semibold">
                        {p.meal_logs.length > 0 ? Math.round(p.meal_logs.reduce((s: number, l: any) => s + (l.total_carbs_g || 0), 0) / p.meal_logs.length) : 0}g
                      </span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      Over target:{" "}
                      <span className="text-amber-600 font-semibold">
                        {p.meal_logs.filter((l: any) => (l.total_carbs_g || 0) > 75).length} / {p.meal_logs.length} meals
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>

            </>
            )}
          </div>
        </div>
      </div>

      {/* ── Write Note Modal ─────────────────────────────────────────────────── */}
      {showWriteNote && p && (
        <WriteNoteModal
          patient={{ id: p.patient_id, name: p.full_name }}
          onClose={() => setShowWriteNote(false)}
          onSave={handleSaveNote}
        />
      )}
    </div>
  );
}
