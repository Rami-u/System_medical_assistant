import { useState, useEffect } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, Dot,
} from "recharts";
import {
  Activity, LayoutDashboard, Droplets, Utensils,
  LineChart as LineChartIcon, Bell, Settings, LogOut, Menu, X,
  AlertTriangle, CheckCircle, Brain, Share2, FileText, RotateCcw,
  ArrowLeft, ArrowUpRight, ArrowDownRight, Minus, Siren, Heart,
  Zap, Shield, Clock, ChevronRight, Phone,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ─── Types (mirrored from GlucoseLogsPage) ───────────────────────────────────
type MeasurementContext = "fasting" | "after-meal" | "before-sleep" | "random";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type ConditionStatus = "Critical" | "Mid" | "Low";

interface GlucoseEntry {
  id: string; date: string; time: string; value: number;
  context: MeasurementContext; notes: string;
}
interface FoodItem { name: string; carbs: number; unit: string; custom?: boolean; }
interface MealEntry {
  id: string; mealType: MealType; foods: FoodItem[];
  portion: "small" | "medium" | "large"; carbEstimate: number; time: string;
}
interface AIResult {
  riskLevel: ConditionStatus; riskScore: number; avgGlucose: number;
  maxGlucose: number; minGlucose: number; spikeCount: number;
  totalCarbs: number; narrative: string[];
  recommendations: { icon: string; text: string }[];
}
interface SummaryPageState {
  glucoseEntries: GlucoseEntry[]; mealEntries: MealEntry[]; aiResult: AIResult;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const ctxConfig: Record<MeasurementContext, { label: string; color: string }> = {
  fasting:        { label: "Fasting",       color: "#3b82f6" },
  "after-meal":   { label: "After Meal",    color: "#f59e0b" },
  "before-sleep": { label: "Before Sleep",  color: "#8b5cf6" },
  random:         { label: "Random",        color: "#94a3b8" },
};

const statusConfig: Record<ConditionStatus, {
  heroGrad: string; badge: string; badgeText: string;
  ring: string; dot: string; bannerBg: string; bannerText: string; bannerBorder: string;
}> = {
  Critical: {
    heroGrad: "from-red-600 via-rose-600 to-red-700",
    badge: "bg-red-100 border-red-300", badgeText: "text-red-700",
    ring: "ring-red-300", dot: "bg-red-500",
    bannerBg: "bg-red-600", bannerText: "text-white", bannerBorder: "border-red-700",
  },
  Mid: {
    heroGrad: "from-amber-500 via-orange-500 to-amber-600",
    badge: "bg-amber-100 border-amber-300", badgeText: "text-amber-700",
    ring: "ring-amber-300", dot: "bg-amber-500",
    bannerBg: "bg-amber-50", bannerText: "text-amber-800", bannerBorder: "border-amber-200",
  },
  Low: {
    heroGrad: "from-emerald-500 via-teal-500 to-emerald-600",
    badge: "bg-emerald-100 border-emerald-300", badgeText: "text-emerald-700",
    ring: "ring-emerald-300", dot: "bg-emerald-500",
    bannerBg: "bg-emerald-50", bannerText: "text-emerald-800", bannerBorder: "border-emerald-200",
  },
};

const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard/patient" },
  { icon: Droplets,        label: "Glucose Logs", path: "/dashboard/patient/glucose" },
  { icon: Utensils,        label: "Meal Logs",    path: "/dashboard/patient/meals" },
  { icon: Settings,        label: "Settings",     path: "/dashboard/patient/settings" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dotColor(v: number) {
  if (v >= 180) return "#ef4444";
  if (v >= 140) return "#f59e0b";
  if (v < 70)   return "#3b82f6";
  return "#10b981";
}

// ─── Custom chart components ──────────────────────────────────────────────────
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const fill = dotColor(payload.glucose);
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={fill} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={2} />
    </g>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const col = dotColor(d.glucose);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xl text-xs min-w-[140px]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col }} />
        <span className="text-slate-900 font-semibold text-sm">{d.glucose} mg/dL</span>
      </div>
      <p className="text-slate-500">{d.time}</p>
      <p className="text-slate-400 capitalize">{d.contextLabel}</p>
      {d.notes && <p className="text-slate-400 mt-1 italic">"{d.notes}"</p>}
    </div>
  );
}

// ─── Emergency Modal ──────────────────────────────────────────────────────────
function EmergencyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        {/* Red header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Siren className="w-6 h-6 text-white" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-white" style={{ fontWeight: 800, fontSize: "1.1rem" }}>Emergency Protocol</h2>
                <p className="text-red-200 text-xs mt-0.5">Critical glucose levels detected — act now</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Immediate actions */}
          <div>
            <h3 className="text-slate-900 text-sm mb-3 flex items-center gap-2" style={{ fontWeight: 700 }}>
              <span className="w-5 h-5 bg-red-100 rounded-full text-red-600 flex items-center justify-center text-[10px] font-bold">!</span>
              Immediate Actions (Next 30 Minutes)
            </h3>
            <div className="space-y-2">
              {[
                "Re-check your blood glucose to confirm the reading.",
                "If glucose is ≥ 300 mg/dL and you have ketones — seek emergency care immediately.",
                "Take your prescribed rapid-acting insulin if instructed by your doctor.",
                "Drink a full glass of water — do NOT drink juice or sugary drinks.",
                "Sit or lie down and avoid strenuous activity.",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 bg-red-50 border border-red-200 rounded-full text-red-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold">{i + 1}</span>
                  <p className="text-slate-700 text-sm leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Symptoms to watch */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="text-amber-800 text-sm mb-2.5" style={{ fontWeight: 700 }}>⚠ Warning Symptoms — Call 999/112 if you experience:</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {["Confusion or disorientation", "Rapid or laboured breathing", "Fruity smell on breath", "Vomiting / nausea", "Loss of consciousness", "Extreme weakness"].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-amber-700 text-xs">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />{s}
                </div>
              ))}
            </div>
          </div>

          {/* Emergency contacts */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors">
              <Phone className="w-4 h-4" />Emergency: 999
            </button>
            <button className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors">
              <Phone className="w-4 h-4" />Dr. Sarah Chen
            </button>
          </div>

          <button onClick={onClose} className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
            I understand — dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AISummaryPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const state = location.state as SummaryPageState | undefined;

  // Redirect if no state
  if (!state?.aiResult) {
    return <Navigate to="/dashboard/patient/glucose" replace />;
  }

  const { glucoseEntries, mealEntries, aiResult } = state;
  const sc = statusConfig[aiResult.riskLevel];

  // Auto-show emergency modal for Critical after short delay
  useEffect(() => {
    if (aiResult.riskLevel === "Critical") {
      const t = setTimeout(() => {
        setShowEmergencyModal(true);
        setAlertSent(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [aiResult.riskLevel]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = glucoseEntries
    .slice()
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .map((e) => ({
      time: e.time,
      glucose: e.value,
      contextLabel: ctxConfig[e.context].label,
      notes: e.notes,
    }));

  const yMin = Math.max(40, Math.min(60, ...(chartData.map((d) => d.glucose))) - 20);
  const yMax = Math.max(180, Math.max(...(chartData.map((d) => d.glucose))) + 30);

  // Meal times to mark on chart
  const mealTimes = mealEntries
    .slice()
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // ── Meal impact ────────────────────────────────────────────────────────────
  const mealImpacts = mealEntries.map((meal) => {
    const mealMins = timeToMinutes(meal.time);
    const afterReadings = glucoseEntries.filter((g) => {
      const gMins = timeToMinutes(g.time);
      return gMins > mealMins && gMins <= mealMins + 180;
    }).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    const beforeReadings = glucoseEntries.filter((g) => {
      const gMins = timeToMinutes(g.time);
      return gMins <= mealMins && gMins >= mealMins - 60;
    }).sort((a, b) => timeToMinutes(b.time) - timeToMinutes(a.time));

    const before = beforeReadings[0];
    const after = afterReadings[0];
    const delta = before && after ? after.value - before.value : null;

    return { meal, before, after, delta };
  });

  const handleSignOut = () => { signOut(); navigate("/"); };

  const mealTypeIcon: Record<MealType, string> = {
    breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎",
  };

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  const Sidebar = () => (
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
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm" style={{ fontWeight: 700 }}>
            {user?.name?.charAt(0) ?? "P"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name}</p>
            <p className="text-slate-400 text-xs">Patient</p>
          </div>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {sidebarNav.map(({ icon: Icon, label, path }) => (
          <button key={label} onClick={() => path && navigate(path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${path ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900" : "text-slate-400 cursor-default"}`}
          >
            <Icon className={`w-4 h-4 ${path ? "text-slate-400" : "text-slate-300"}`} strokeWidth={1.8} />
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
  );

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Top bar ── */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-slate-500" />
            </button>
            <button onClick={() => navigate("/dashboard/patient/glucose")} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Log</span>
            </button>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-teal-400 rounded-md flex items-center justify-center">
                <Brain className="w-3 h-3 text-white" strokeWidth={2} />
              </div>
              <span className="text-slate-700 text-sm" style={{ fontWeight: 600 }}>AI Condition Summary</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs hidden md:block">
              {glucoseEntries.length} readings · {mealEntries.length} meals · Apr 30, 2026
            </span>
            <button
              onClick={() => navigate("/dashboard/patient/glucose")}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />Log More
            </button>
          </div>
        </header>

        {/* ── Critical alert banner ── */}
        {aiResult.riskLevel === "Critical" && !alertDismissed && (
          <div className="bg-red-600 border-b border-red-700 px-5 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Siren className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm" style={{ fontWeight: 700 }}>
                {alertSent ? "✓ Doctor alert automatically sent" : "Sending doctor alert…"}
              </p>
              <p className="text-red-200 text-xs truncate">
                Dr. Sarah Chen has been notified of your critical readings · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="flex-shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 border border-white/30 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              Emergency Protocol
            </button>
            <button onClick={() => setAlertDismissed(true)} className="text-red-200 hover:text-white flex-shrink-0 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Mid status banner ── */}
        {aiResult.riskLevel === "Mid" && (
          <div className={`${sc.bannerBg} border-b ${sc.bannerBorder} px-5 py-2.5 flex items-center gap-3 flex-shrink-0`}>
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className={`text-sm ${sc.bannerText}`} style={{ fontWeight: 500 }}>
              Moderate risk detected. Review the recommendations below and consider consulting your doctor this week.
            </p>
          </div>
        )}

        {/* ── Scrollable body ── */}
        <main className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ── Hero: Condition badge + summary ── */}
            <div className={`rounded-3xl bg-gradient-to-br ${sc.heroGrad} p-7 text-white shadow-xl relative overflow-hidden`}>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-start gap-6">
                {/* Score circle */}
                <div className="flex-shrink-0">
                  <div className="w-28 h-28 rounded-full border-4 border-white/30 bg-white/15 backdrop-blur-sm flex flex-col items-center justify-center shadow-inner">
                    <span className="text-white" style={{ fontWeight: 900, fontSize: "2.2rem", lineHeight: 1 }}>{aiResult.riskScore}</span>
                    <span className="text-white/60 text-xs mt-0.5">/ 100</span>
                  </div>
                  <p className="text-white/70 text-xs text-center mt-2">Risk Score</p>
                </div>

                <div className="flex-1">
                  {/* Status label */}
                  <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 backdrop-blur-sm rounded-full px-3.5 py-1.5 mb-3">
                    <span className={`w-2 h-2 rounded-full ${sc.dot} ring-2 ${sc.ring}`} />
                    <span className="text-white text-xs font-semibold uppercase tracking-widest">{aiResult.riskLevel} Risk</span>
                  </div>

                  <h1 className="text-white mb-3" style={{ fontWeight: 900, fontSize: "clamp(1.4rem, 3vw, 1.9rem)", lineHeight: 1.2 }}>
                    {aiResult.riskLevel === "Critical"
                      ? "Critical Condition — Immediate Action Required"
                      : aiResult.riskLevel === "Mid"
                      ? "Moderate Risk — Monitor & Adjust Lifestyle"
                      : "Good Control — Keep Up the Great Work!"}
                  </h1>

                  {/* AI narrative intro */}
                  <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                    {aiResult.narrative[0]}
                  </p>

                  {/* Mini stats row */}
                  <div className="flex flex-wrap gap-4 mt-4">
                    {[
                      { label: "Avg Glucose", value: aiResult.avgGlucose ? `${aiResult.avgGlucose} mg/dL` : "—" },
                      { label: "Peak", value: aiResult.maxGlucose ? `${aiResult.maxGlucose} mg/dL` : "—" },
                      { label: "Spikes", value: String(aiResult.spikeCount) },
                      { label: "Total Carbs", value: aiResult.totalCarbs ? `${aiResult.totalCarbs}g` : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/15 border border-white/20 rounded-xl px-3 py-2 backdrop-blur-sm">
                        <p className="text-white/60 text-xs">{label}</p>
                        <p className="text-white text-sm" style={{ fontWeight: 700 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* ── Left column (3/5) ── */}
              <div className="lg:col-span-3 space-y-5">

                {/* Glucose trend chart */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Glucose Trend</h2>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {glucoseEntries.length} reading{glucoseEntries.length !== 1 ? "s" : ""} logged today
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded-full" />Normal</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded-full" />High</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 inline-block rounded-full" />Critical</span>
                    </div>
                  </div>

                  {glucoseEntries.length < 2 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Droplets className="w-5 h-5 text-blue-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-400 text-sm">
                        {glucoseEntries.length === 0
                          ? "No glucose readings submitted"
                          : "Add at least 2 readings to show the trend"}
                      </p>
                      {glucoseEntries.length === 1 && (
                        <div className="mt-3 flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-2">
                          <span className="text-blue-600 text-sm font-semibold">{glucoseEntries[0].value} mg/dL</span>
                          <span className="text-slate-400 text-xs">at {glucoseEntries[0].time} · {ctxConfig[glucoseEntries[0].context].label}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          {/* Normal range shading */}
                          <ReferenceArea y1={70} y2={140} fill="#d1fae5" fillOpacity={0.35} />
                          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                          <Tooltip content={<CustomTooltip />} />
                          {/* Reference lines */}
                          <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                            label={{ value: "140", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                          <ReferenceLine y={70} stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={1.5}
                            label={{ value: "70", position: "right", fontSize: 10, fill: "#3b82f6" }} />
                          {/* Meal time markers */}
                          {mealTimes.map((m) => (
                            <ReferenceLine key={m.id} x={m.time} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1}
                              label={{ value: m.mealType[0].toUpperCase(), position: "top", fontSize: 9, fill: "#94a3b8" }} />
                          ))}
                          <Line
                            type="monotone" dataKey="glucose"
                            stroke="#3b82f6" strokeWidth={2.5}
                            dot={<CustomDot />} activeDot={{ r: 7, strokeWidth: 2, stroke: "white" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Chart legend footer */}
                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-50 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-lg text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />Normal: 70–139 mg/dL
                    </span>
                    <span className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg text-amber-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Elevated: 140–179 mg/dL
                    </span>
                    <span className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg text-red-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />Critical: ≥180 mg/dL
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-px bg-slate-300 border-t border-dashed border-slate-400" />Meal time
                    </span>
                  </div>
                </div>

                {/* Meal impact analysis */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Meal Impact Analysis</h2>
                      <p className="text-slate-400 text-xs mt-0.5">How your meals correlated with glucose changes</p>
                    </div>
                    <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Utensils className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.8} />
                    </div>
                  </div>

                  {mealEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Utensils className="w-5 h-5 text-emerald-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-400 text-sm">No meals were logged in this session</p>
                      <p className="text-slate-300 text-xs mt-1">Log meals alongside glucose readings for better insights</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {mealImpacts.map(({ meal, before, after, delta }) => {
                        const isSpike = delta !== null && delta > 40;
                        const isHigh = after && after.value > 140;
                        return (
                          <div key={meal.id} className={`rounded-2xl border p-4 ${isHigh ? "bg-amber-50/60 border-amber-200" : "bg-slate-50/60 border-slate-100"}`}>
                            <div className="flex items-start gap-3">
                              {/* Meal info */}
                              <div className="text-xl flex-shrink-0 mt-0.5">{mealTypeIcon[meal.mealType]}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className="text-slate-800 text-sm capitalize" style={{ fontWeight: 700 }}>{meal.mealType}</span>
                                  <span className="text-xs text-slate-400">· {meal.time}</span>
                                  {meal.carbEstimate > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                      ~{meal.carbEstimate}g carbs
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-500 text-xs line-clamp-1">
                                  {meal.foods.map((f) => f.name).join(", ")}
                                </p>

                                {/* Impact row */}
                                {(before || after) && (
                                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                    {before && (
                                      <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-1.5 text-xs">
                                        <Droplets className="w-3 h-3 text-blue-500" />
                                        <span className="text-blue-700 font-semibold">{before.value}</span>
                                        <span className="text-blue-400">before</span>
                                      </div>
                                    )}
                                    {before && after && (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                    )}
                                    {after && (
                                      <div className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs border ${isHigh ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-100"}`}>
                                        <Droplets className={`w-3 h-3 ${isHigh ? "text-amber-500" : "text-emerald-500"}`} />
                                        <span className={`font-semibold ${isHigh ? "text-amber-700" : "text-emerald-700"}`}>{after.value}</span>
                                        <span className={isHigh ? "text-amber-400" : "text-emerald-400"}>after</span>
                                      </div>
                                    )}
                                    {delta !== null && (
                                      <div className={`flex items-center gap-1 text-xs font-semibold ${delta > 40 ? "text-red-600" : delta > 20 ? "text-amber-600" : delta < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                                        {delta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : delta < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                        {delta > 0 ? "+" : ""}{delta} mg/dL
                                      </div>
                                    )}
                                    {isSpike && (
                                      <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-200">
                                        Spike detected
                                      </span>
                                    )}
                                  </div>
                                )}
                                {!before && !after && (
                                  <p className="text-slate-300 text-xs mt-1.5 italic">No glucose readings near this meal to correlate</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Full narrative */}
                {aiResult.narrative.length > 1 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Brain className="w-4 h-4 text-blue-600" strokeWidth={1.8} />
                      </div>
                      <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Full AI Analysis</h2>
                    </div>
                    <div className="space-y-3">
                      {aiResult.narrative.slice(1).map((p, i) => (
                        <p key={i} className="text-slate-600 text-sm leading-relaxed">{p}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right column (2/5) ── */}
              <div className="lg:col-span-2 space-y-5">

                {/* AI Recommendations */}
                <div className={`rounded-2xl border shadow-sm overflow-hidden ${aiResult.riskLevel === "Critical" ? "border-red-200" : aiResult.riskLevel === "Mid" ? "border-amber-200" : "border-emerald-200"}`}>
                  <div className={`px-5 py-4 bg-gradient-to-br ${sc.heroGrad}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" strokeWidth={2} />
                      </div>
                      <div>
                        <h2 className="text-white text-sm" style={{ fontWeight: 700 }}>AI Recommendations</h2>
                        <p className="text-white/60 text-xs">{aiResult.recommendations.length} personalised actions</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 space-y-2.5">
                    {aiResult.recommendations.map((rec, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${i === 0 && aiResult.riskLevel !== "Low" ? `${sc.badge} border` : "bg-slate-50"}`}>
                        <span className="text-xl leading-none flex-shrink-0 mt-0.5">{rec.icon}</span>
                        <p className={`text-xs leading-relaxed ${i === 0 && aiResult.riskLevel !== "Low" ? sc.badgeText : "text-slate-700"}`}>{rec.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Emergency quick actions (Critical only) */}
                {aiResult.riskLevel === "Critical" && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Siren className="w-5 h-5 text-red-600 flex-shrink-0" strokeWidth={1.8} />
                      <h2 className="text-red-800 text-sm" style={{ fontWeight: 700 }}>Emergency Checklist</h2>
                    </div>
                    <div className="space-y-2 mb-4">
                      {[
                        "Re-check glucose to confirm reading",
                        "Do NOT eat or drink sugary items",
                        "Take medication if prescribed",
                        "Monitor for warning symptoms",
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-red-700 text-xs">
                          <Shield className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                          {item}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowEmergencyModal(true)}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Siren className="w-3.5 h-3.5" />View Full Emergency Protocol
                    </button>
                  </div>
                )}

                {/* Health snapshot */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h2 className="text-slate-900 text-sm mb-4" style={{ fontWeight: 700 }}>Today's Snapshot</h2>
                  <div className="space-y-3">
                    {[
                      { label: "Readings logged", value: String(glucoseEntries.length), icon: Droplets, color: "blue" },
                      { label: "Meals logged", value: String(mealEntries.length), icon: Utensils, color: "emerald" },
                      { label: "Glucose spikes", value: String(aiResult.spikeCount), icon: AlertTriangle, color: aiResult.spikeCount > 0 ? "amber" : "slate" },
                      { label: "Total carbs", value: aiResult.totalCarbs ? `${aiResult.totalCarbs}g` : "—", icon: Heart, color: "purple" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-slate-500">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color === "blue" ? "bg-blue-50" : color === "emerald" ? "bg-emerald-50" : color === "amber" ? "bg-amber-50" : color === "purple" ? "bg-purple-50" : "bg-slate-100"}`}>
                            <Icon className={`w-3 h-3 ${color === "blue" ? "text-blue-500" : color === "emerald" ? "text-emerald-500" : color === "amber" ? "text-amber-500" : color === "purple" ? "text-purple-500" : "text-slate-400"}`} strokeWidth={1.8} />
                          </div>
                          {label}
                        </div>
                        <span className="text-slate-800 text-sm font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2.5">
                  <button className="w-full flex items-center gap-3 p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-200">
                    <Share2 className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                    Share Report with Doctor
                  </button>
                  <button className="w-full flex items-center gap-3 p-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                    <FileText className="w-4 h-4 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                    Download PDF Report
                  </button>
                  <button onClick={() => navigate("/dashboard/patient")} className="w-full flex items-center gap-3 p-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-slate-400" strokeWidth={1.8} />
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Emergency modal */}
      {showEmergencyModal && <EmergencyModal onClose={() => setShowEmergencyModal(false)} />}
    </div>
  );
}