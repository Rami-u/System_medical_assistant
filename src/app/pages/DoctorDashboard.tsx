import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, LogOut, Menu, X,
  Users, AlertTriangle, CheckCircle, ChevronRight,
  Droplets, TrendingUp, TrendingDown, Stethoscope,
  Bell, Clock, FileText, Send, Loader2, Eye,
  MessageSquare, AlertOctagon, Info, Heart,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertType   = "diabetes-critical" | "diabetes-moderate";
type AlertStatus = "unread" | "read" | "reviewed";

interface PatientAlert {
  id: string;
  patientName: string;
  patientId: string;
  alertType: AlertType;
  severity: "critical" | "moderate" | "low";
  timestamp: string;
  status: AlertStatus;
  summary: string;
  doctorNotes?: string;
  reportData: {
    glucoseData?: {
      avgGlucose: number;
      maxGlucose: number;
      spikeCount: number;
      lastReading: number;
    };
  };
}

interface PatientSummary {
  id: string;
  name: string;
  initials: string;
  diagnosis: string;
  hba1c: number;
  avgGlucose: number;
  tir: number;             // time-in-range %
  riskLevel: "high" | "moderate" | "low";
  lastVisit: string;
  glucoseTrend: "up" | "down" | "stable";
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/doctor",          active: true  },
  { icon: Users,           label: "Patients",  path: "/dashboard/doctor/patients", active: false },
];

// ─── Patient Overview Data ────────────────────────────────────────────────────
const patientSummaries: PatientSummary[] = [
  { id: "P-2847", name: "John Anderson",   initials: "JA", diagnosis: "Type 2 Diabetes", hba1c: 8.2, avgGlucose: 156, tir: 28, riskLevel: "high",     lastVisit: "Apr 20", glucoseTrend: "up"    },
  { id: "P-1583", name: "Michael Chen",    initials: "MC", diagnosis: "Type 2 Diabetes", hba1c: 7.4, avgGlucose: 148, tir: 60, riskLevel: "moderate", lastVisit: "Apr 25", glucoseTrend: "stable" },
  { id: "P-2156", name: "David Kim",       initials: "DK", diagnosis: "Type 1 Diabetes", hba1c: 6.8, avgGlucose: 98,  tir: 62, riskLevel: "high",     lastVisit: "Apr 18", glucoseTrend: "down"  },
  { id: "P-3041", name: "Emily Rodriguez", initials: "ER", diagnosis: "Type 2 Diabetes", hba1c: 7.1, avgGlucose: 132, tir: 74, riskLevel: "moderate", lastVisit: "Apr 28", glucoseTrend: "down"  },
  { id: "P-1892", name: "Sarah Thompson",  initials: "ST", diagnosis: "Type 1 Diabetes", hba1c: 6.4, avgGlucose: 108, tir: 91, riskLevel: "low",      lastVisit: "Apr 30", glucoseTrend: "stable" },
  { id: "P-4217", name: "Robert Martinez", initials: "RM", diagnosis: "Type 2 Diabetes", hba1c: 9.1, avgGlucose: 188, tir: 14, riskLevel: "high",     lastVisit: "Apr 15", glucoseTrend: "up"    },
  { id: "P-3388", name: "Linda Patel",     initials: "LP", diagnosis: "Prediabetes",      hba1c: 6.1, avgGlucose: 112, tir: 84, riskLevel: "low",      lastVisit: "Apr 27", glucoseTrend: "stable" },
];

// ─── Chart Data ───────────────────────────────────────────────────────────────
const populationTrend = [
  { date: "Apr 26", avg: 141, min: 109, max: 195 },
  { date: "Apr 27", avg: 143, min: 94,  max: 219 },
  { date: "Apr 28", avg: 138, min: 81,  max: 207 },
  { date: "Apr 29", avg: 140, min: 68,  max: 221 },
  { date: "Apr 30", avg: 144, min: 52,  max: 248 },
  { date: "May 1",  avg: 136, min: 78,  max: 202 },
  { date: "May 2",  avg: 131, min: 84,  max: 193 },
];

const hba1cData = [
  { name: "J. Anderson",  hba1c: 8.2, risk: "high"     },
  { name: "R. Martinez",  hba1c: 9.1, risk: "high"     },
  { name: "D. Kim",       hba1c: 6.8, risk: "high"     },
  { name: "M. Chen",      hba1c: 7.4, risk: "moderate" },
  { name: "E. Rodriguez", hba1c: 7.1, risk: "moderate" },
  { name: "S. Thompson",  hba1c: 6.4, risk: "low"      },
  { name: "L. Patel",     hba1c: 6.1, risk: "low"      },
];

const riskPieData = [
  { name: "High Risk",  value: 3, color: "#ef4444" },
  { name: "Moderate",   value: 2, color: "#f59e0b" },
  { name: "Low Risk",   value: 2, color: "#10b981" },
];

// ─── Alert Mock Data ──────────────────────────────────────────────────────────
const initialAlerts: PatientAlert[] = [
  {
    id: "alert-001", patientName: "John Anderson",  patientId: "P-2847",
    alertType: "diabetes-critical", severity: "critical",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: "unread",
    summary: "Critical glucose spike detected: 248 mg/dL post-meal. Patient experiencing symptoms of hyperglycemia.",
    reportData: { glucoseData: { avgGlucose: 156, maxGlucose: 248, spikeCount: 3, lastReading: 248 } },
  },
  {
    id: "alert-003", patientName: "Michael Chen",   patientId: "P-1583",
    alertType: "diabetes-moderate", severity: "moderate",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: "read",
    summary: "Consistent elevated post-meal glucose (avg 165 mg/dL). Pattern suggests dietary adjustment needed.",
    reportData: { glucoseData: { avgGlucose: 148, maxGlucose: 182, spikeCount: 5, lastReading: 165 } },
  },
  {
    id: "alert-005", patientName: "David Kim",       patientId: "P-2156",
    alertType: "diabetes-critical", severity: "critical",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    status: "read",
    summary: "Severe hypoglycemia event: 52 mg/dL. Patient reported dizziness and confusion.",
    reportData: { glucoseData: { avgGlucose: 98, maxGlucose: 142, spikeCount: 1, lastReading: 52 } },
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────
const riskConfig = {
  high:     { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   dot: "bg-red-500",    label: "High Risk" },
  moderate: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", dot: "bg-amber-500",  label: "Moderate"  },
  low:      { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot:"bg-emerald-500",label: "Low Risk"  },
};

const severityConfig = {
  critical: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   dot: "bg-red-500",    label: "Critical" },
  moderate: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", dot: "bg-amber-500",  label: "Moderate" },
  low:      { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot:"bg-emerald-500",label: "Low"      },
};

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const PopTrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="text-slate-500 mb-1.5">{label}</p>
      <p className="text-blue-700 font-bold">Avg: {payload.find((p: any) => p.dataKey === "avg")?.value} mg/dL</p>
      <p className="text-red-500 mt-0.5">Max: {payload.find((p: any) => p.dataKey === "max")?.value} mg/dL</p>
      <p className="text-slate-500 mt-0.5">Min: {payload.find((p: any) => p.dataKey === "min")?.value} mg/dL</p>
    </div>
  );
};

const HbA1cTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val >= 8 ? "#ef4444" : val >= 6.5 ? "#f59e0b" : "#10b981";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      <p style={{ color, fontWeight: 700 }}>{val}% HbA1c</p>
    </div>
  );
};

// ─── Alert Details Modal ──────────────────────────────────────────────────────
function AlertDetailsModal({ alert, onClose, onReview }: {
  alert: PatientAlert;
  onClose: () => void;
  onReview: (id: string, notes: string) => void;
}) {
  const [notes,  setNotes]  = useState(alert.doctorNotes || "");
  const [saving, setSaving] = useState(false);
  const sev = severityConfig[alert.severity];

  const handleReview = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    onReview(alert.id, notes);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden z-10 flex flex-col">
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Droplets className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-slate-900" style={{ fontWeight: 700, fontSize: "1.05rem" }}>{alert.patientName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-slate-400 text-xs">{alert.patientId}</span>
                <span className="text-slate-300">·</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sev.bg} ${sev.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />{sev.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-slate-700 text-sm leading-relaxed">{alert.summary}</p>
            <p className="text-slate-400 text-xs mt-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(alert.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          {alert.reportData.glucoseData && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Last Reading", value: alert.reportData.glucoseData.lastReading, unit: "mg/dL", bg: "bg-blue-50 border-blue-100", val: "text-blue-900" },
                { label: "Avg Glucose",  value: alert.reportData.glucoseData.avgGlucose,  unit: "mg/dL", bg: "bg-slate-50 border-slate-100", val: "text-slate-900" },
                { label: "Peak Glucose", value: alert.reportData.glucoseData.maxGlucose,  unit: "mg/dL", bg: "bg-red-50 border-red-100",   val: "text-red-900" },
                { label: "Spike Events", value: alert.reportData.glucoseData.spikeCount,  unit: "events",bg: "bg-amber-50 border-amber-100",val: "text-amber-900" },
              ].map(({ label, value, unit, bg, val }) => (
                <div key={label} className={`rounded-xl p-4 border ${bg}`}>
                  <p className="text-slate-500 text-xs mb-1">{label}</p>
                  <p className={`text-2xl ${val}`} style={{ fontWeight: 800 }}>{value}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{unit}</p>
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <h4 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Doctor's Response</h4>
              {alert.status === "reviewed" && <span className="text-xs text-emerald-600 font-semibold">(Sent to Patient)</span>}
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Write your clinical assessment, recommendations, or instructions…"
              rows={4}
              disabled={alert.status === "reviewed"}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Close</button>
          {alert.status !== "reviewed" && (
            <button
              onClick={handleReview}
              disabled={!notes.trim() || saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Mark Reviewed & Send</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<PatientAlert[]>(initialAlerts);
  const [selectedAlert, setSelectedAlert] = useState<PatientAlert | null>(null);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const handleAlertClick = (alert: PatientAlert) => {
    setSelectedAlert(alert);
    if (alert.status === "unread") {
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: "read" as AlertStatus } : a));
    }
  };

  const handleReview = (alertId: string, notes: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "reviewed" as AlertStatus, doctorNotes: notes } : a));
    setSelectedAlert(null);
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total        = patientSummaries.length;
  const inRange      = patientSummaries.filter(p => p.tir >= 70).length;
  const needAttn     = patientSummaries.filter(p => p.riskLevel === "high").length;
  const unreadCount  = alerts.filter(a => a.status === "unread").length;
  const attentionPts = patientSummaries.filter(p => p.tir < 70).sort((a, b) => a.tir - b.tir);

  const hba1cBarColor = (v: number) => v >= 8 ? "#ef4444" : v >= 6.5 ? "#f59e0b" : "#10b981";

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ").slice(1).join(" ") || user?.name || "Doctor";

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

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
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
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
          {sidebarNav.map(({ icon: Icon, label, active, path }) => (
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
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" strokeWidth={1.8} />Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
                <Bell className="w-3.5 h-3.5" />{unreadCount} New Alert{unreadCount > 1 ? "s" : ""}
              </div>
            )}
            <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold">{unreadCount}</span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* ── Greeting ───────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.02em" }}>
                  {greeting}, Dr. {firstName}! 👋
                </h1>
                <p className="text-slate-500 text-sm mt-1">Here's your patient population overview — Friday, May 2, 2026</p>
              </div>
              <button
                onClick={() => navigate("/dashboard/doctor/patients")}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <Users className="w-4 h-4" />View All Patients
              </button>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  label: "Total Patients", value: total, unit: "registered",
                  icon: Users, bg: "bg-blue-50", iconColor: "text-blue-600",
                  valColor: "text-slate-900", trend: null,
                },
                {
                  label: "In Range", value: inRange, unit: `${Math.round(inRange/total*100)}% of patients`,
                  icon: CheckCircle, bg: "bg-emerald-50", iconColor: "text-emerald-600",
                  valColor: "text-emerald-700", trend: "TIR ≥ 70%",
                },
                {
                  label: "Need Attention", value: needAttn, unit: "high-risk patients",
                  icon: AlertTriangle, bg: "bg-red-50", iconColor: "text-red-600",
                  valColor: "text-red-700", trend: "High risk",
                },
              ].map(({ label, value, unit, icon: Icon, bg, iconColor, valColor, trend }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.8} />
                    </div>
                    {trend && <span className="text-slate-400 text-xs bg-slate-50 px-2 py-1 rounded-lg">{trend}</span>}
                  </div>
                  <p className="text-slate-400 text-xs mb-1">{label}</p>
                  <p className={`${valColor}`} style={{ fontWeight: 800, fontSize: "2rem", lineHeight: 1 }}>{value}</p>
                  <p className="text-slate-400 text-xs mt-1">{unit}</p>
                </div>
              ))}
            </div>

            {/* ── Charts Row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Population Glucose Trend */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Population Glucose Trend</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Daily avg, min & max across all patients — last 7 days</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {[
                      { color: "bg-blue-500", label: "Average" },
                      { color: "bg-red-300",  label: "Max" },
                      { color: "bg-slate-300",label: "Min" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                        <span className="text-slate-400">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={populationTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[40, 260]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickCount={5} />
                    <Tooltip content={<PopTrendTooltip />} />
                    <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: "High", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                    <ReferenceLine y={70}  stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: "Low",  position: "right", fontSize: 10, fill: "#3b82f6" }} />
                    <Area type="monotone" dataKey="max" stroke="#fca5a5" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="3 2" />
                    <Area type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2.5} fill="url(#avgGrad)"
                      dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="min" stroke="#cbd5e1" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="3 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Distribution Donut */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
                <div className="mb-4">
                  <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Risk Distribution</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Patient population breakdown</p>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative">
                    <ResponsiveContainer width={170} height={170}>
                      <PieChart>
                        <Pie
                          data={riskPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          {riskPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.6rem", lineHeight: 1 }}>{total}</p>
                      <p className="text-slate-400 text-xs mt-0.5">patients</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  {riskPieData.map(({ name, value, color }) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-slate-600 text-xs">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(value / total) * 100}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-slate-700 text-xs w-4 text-right" style={{ fontWeight: 600 }}>{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── HbA1c Per Patient ───────────────────────────────────────────── */}
            

            {/* ── Patients Needing Attention ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-50">
                <div>
                  <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Patients Needing Attention</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Time-in-range below 70% · sorted by urgency</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-semibold border border-red-100">
                  {attentionPts.length} patients
                </span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-5 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-400 font-semibold">
                <span className="col-span-2">Patient</span>
                <span>Avg Glucose</span>
                <span>Time in Range</span>
                <span>Last Visit</span>
              </div>

              <div className="divide-y divide-slate-50">
                {attentionPts.map(p => {
                  const risk = riskConfig[p.riskLevel];
                  const tirColor = p.tir < 30 ? "text-red-700 bg-red-50"
                                 : p.tir < 50 ? "text-amber-700 bg-amber-50"
                                              : "text-yellow-700 bg-yellow-50";
                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate("/dashboard/doctor/patients")}
                      className="grid grid-cols-5 items-center px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs flex-shrink-0" style={{ fontWeight: 700 }}>
                          {p.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{p.name}</p>
                          <p className="text-slate-400 text-xs">{p.id} · {p.diagnosis}</p>
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${p.avgGlucose >= 140 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                          <Droplets className="w-3 h-3" />
                          {p.avgGlucose} mg/dL
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${p.tir < 30 ? "bg-red-500" : p.tir < 50 ? "bg-amber-500" : "bg-yellow-500"}`}
                              style={{ width: `${p.tir}%` }}
                            />
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${tirColor}`}>{p.tir}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${risk.bg} ${risk.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                            {risk.label}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Recent Alerts ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-50">
                <div>
                  <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Recent Alerts</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Latest patient health notifications</p>
                </div>
                {unreadCount > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-50">
                {alerts.slice(0, 4).map(alert => {
                  const sev = severityConfig[alert.severity];
                  return (
                    <div
                      key={alert.id}
                      onClick={() => handleAlertClick(alert)}
                      className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer ${alert.status === "unread" ? "bg-blue-50/30" : ""}`}
                    >
                      <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 relative">
                        <Droplets className="w-4 h-4 text-blue-500" strokeWidth={1.8} />
                        {alert.status === "unread" && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>{alert.patientName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sev.bg} ${sev.text}`}>
                            {sev.label}
                          </span>
                          {alert.status === "reviewed" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">Reviewed</span>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs truncate">{alert.summary}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-slate-300 text-xs">{timeAgo(alert.timestamp)}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ── Alert Modal ──────────────────────────────────────────────────────── */}
      {selectedAlert && (
        <AlertDetailsModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onReview={handleReview}
        />
      )}
    </div>
  );
}