import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, Bell, Settings, LogOut,
  Menu, X, Droplets, Utensils, Clock, ChevronRight,
  AlertTriangle, CheckCircle, Info, Loader2, Plus,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles,
  TrendingUp, TrendingDown, BarChart2, FileText,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, AreaChart, Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClinicalNote {
  id: string;
  patientId: string;
  text: string;
  priority: "routine" | "urgent" | "critical";
  date: string;
  time: string;
  doctorName: string;
}

// Demo: show notes written for patient P-2847 (John Anderson) as the logged-in patient
const DEMO_PATIENT_ID = "P-2847";
const NOTES_KEY = "diacheck_clinical_notes";

const mockDoctorNotes: ClinicalNote[] = [
  {
    id: "mock-note-001",
    patientId: DEMO_PATIENT_ID,
    text: "Your glucose readings have been consistently elevated post-meal this week, averaging 165 mg/dL. Please avoid high-carb meals such as white rice, bread, and sugary drinks. Aim to walk for 15–20 minutes after each meal to help lower post-meal spikes. Continue taking Metformin with food as prescribed.",
    priority: "urgent",
    date: "Apr 30, 2026",
    time: "11:20 AM",
    doctorName: "Dr. Sarah Chen",
  },
  {
    id: "mock-note-002",
    patientId: DEMO_PATIENT_ID,
    text: "Great progress on your fasting glucose levels — they've dropped from 138 mg/dL to 112 mg/dL over the past two weeks. Keep up the dietary changes and regular logging. Schedule your next HbA1c lab test within the next 10 days so we can review your 3-month average at our upcoming appointment.",
    priority: "routine",
    date: "Apr 25, 2026",
    time: "2:45 PM",
    doctorName: "Dr. Sarah Chen",
  },
  {
    id: "mock-note-003",
    patientId: DEMO_PATIENT_ID,
    text: "I noticed a hypoglycemic event recorded on Apr 18 (52 mg/dL). Please ensure you always carry fast-acting glucose (juice or glucose tablets) with you. If this happens again, consume 15g of carbs immediately and recheck in 15 minutes. Do not skip meals.",
    priority: "critical",
    date: "Apr 19, 2026",
    time: "9:05 AM",
    doctorName: "Dr. Sarah Chen",
  },
];

function loadDoctorNotes(): ClinicalNote[] {
  try {
    const all: ClinicalNote[] = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    const saved = all.filter(n => n.patientId === DEMO_PATIENT_ID);
    // Merge saved notes on top of mock notes, avoiding duplicates by id
    const savedIds = new Set(saved.map(n => n.id));
    const mocks = mockDoctorNotes.filter(n => !savedIds.has(n.id));
    return [...saved, ...mocks];
  } catch { return mockDoctorNotes; }
}

type ConditionStatus = "Critical" | "Mid" | "Low";
type LogType = "glucose" | "meal" | "alert";

interface ActivityLog {
  id: number;
  type: LogType;
  title: string;
  detail: string;
  time: string;
  trend?: "up" | "down" | "stable";
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const initialActivity: ActivityLog[] = [
  { id: 1, type: "glucose", title: "Fasting Glucose Logged", detail: "112 mg/dL", time: "Today, 7:30 AM", trend: "up" },
  { id: 2, type: "meal",    title: "Breakfast Logged",       detail: "Oatmeal + fruit · ~65g carbs", time: "Today, 8:10 AM" },
  { id: 3, type: "glucose", title: "Post-meal Glucose",      detail: "148 mg/dL", time: "Today, 10:00 AM", trend: "up" },
  { id: 4, type: "meal",    title: "Lunch Logged",            detail: "Grilled chicken + rice · ~80g carbs", time: "Yesterday, 1:00 PM" },
];

const notifications = [
  { id: 1, type: "doctor",  text: "Dr. Sarah Chen responded to your weekly report.", time: "30 min ago", unread: true },
  { id: 2, type: "alert",   text: "Your post-meal glucose exceeded 140 mg/dL twice this week.", time: "2h ago", unread: true },
  { id: 3, type: "reminder",text: "HbA1c lab test is due in 5 days. Schedule now.", time: "Yesterday", unread: false },
  { id: 4, type: "doctor",  text: "Dr. Chen updated your medication plan.", time: "2 days ago", unread: false },
];

const statusConfig: Record<ConditionStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  Critical: { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-200",   dot: "bg-red-500",    label: "Critical" },
  Mid:      { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200", dot: "bg-amber-500",  label: "Mid Risk" },
  Low:      { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200",dot:"bg-emerald-500", label: "Low Risk" },
};

const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard/patient",          active: true  },
  { icon: Droplets,        label: "Glucose Logs", path: "/dashboard/patient/glucose",  active: false },
  { icon: Utensils,        label: "Meal Logs",    path: "/dashboard/patient/meals",    active: false },
  { icon: Sparkles,        label: "AI Assistant", path: "/dashboard/patient/ai-chat",  active: false },
  { icon: Settings,        label: "Settings",     path: "/dashboard/patient/settings", active: false },
];

// ─── Log Glucose Modal ────────────────────────────────────────────────────────
function LogGlucoseModal({ onClose, onSave }: { onClose: () => void; onSave: (log: ActivityLog) => void }) {
  const [value, setValue] = useState("");
  const [time, setTime] = useState("fasting");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!value) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const num = parseFloat(value);
    const trend: "up" | "down" | "stable" = num > 140 ? "up" : num < 70 ? "down" : "stable";
    onSave({
      id: Date.now(),
      type: "glucose",
      title: `${time.charAt(0).toUpperCase() + time.slice(1)} Glucose Logged`,
      detail: `${value} mg/dL${note ? " · " + note : ""}`,
      time: "Just now",
      trend,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Droplets className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-slate-900" style={{ fontWeight: 700 }}>Log Glucose</h3>
              <p className="text-slate-400 text-xs">Record your blood glucose reading</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Glucose Value (mg/dL)</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 96"
              min={20}
              max={600}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
              autoFocus
            />
            {value && (
              <p className={`text-xs mt-1.5 font-medium ${parseFloat(value) < 70 ? "text-blue-600" : parseFloat(value) > 140 ? "text-red-600" : "text-emerald-600"}`}>
                {parseFloat(value) < 70 ? "⚠ Below normal range (hypoglycemia)" : parseFloat(value) > 140 ? "⚠ Above normal range (hyperglycemia)" : "✓ Within normal range"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Reading Type</label>
            <div className="grid grid-cols-3 gap-2">
              {["fasting", "post-meal", "bedtime"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all capitalize ${time === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Before breakfast, felt tired…"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!value || loading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Reading"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Meal Modal ───────────────────────────────────────────────────────────
function LogMealModal({ onClose, onSave }: { onClose: () => void; onSave: (log: ActivityLog) => void }) {
  const [meal, setMeal] = useState("");
  const [carbs, setCarbs] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!meal) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    onSave({
      id: Date.now(),
      type: "meal",
      title: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Logged`,
      detail: `${meal}${carbs ? ` · ~${carbs}g carbs` : ""}`,
      time: "Just now",
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Utensils className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-slate-900" style={{ fontWeight: 700 }}>Log Meal</h3>
              <p className="text-slate-400 text-xs">Record what you ate</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>Meal Type</label>
            <div className="grid grid-cols-4 gap-2">
              {["breakfast", "lunch", "dinner", "snack"].map((t) => (
                <button
                  key={t}
                  onClick={() => setMealType(t)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all capitalize ${mealType === t ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>What did you eat?</label>
            <input
              type="text"
              value={meal}
              onChange={(e) => setMeal(e.target.value)}
              placeholder="e.g. Grilled chicken with salad"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>
              Estimated Carbs (g) <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="e.g. 45"
              min={0}
              max={500}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!meal || loading}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Log Meal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Icon ────────────────────────────────────────────────────────────
function ActivityIcon({ type }: { type: LogType }) {
  const map: Record<LogType, { icon: React.ElementType; bg: string; color: string }> = {
    glucose: { icon: Droplets,      bg: "bg-blue-50",   color: "text-blue-500" },
    meal:    { icon: Utensils,      bg: "bg-emerald-50",color: "text-emerald-500" },
    alert:   { icon: AlertTriangle, bg: "bg-red-50",    color: "text-red-500" },
  };
  const { icon: Icon, bg, color } = map[type];
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
      <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.8} />
    </div>
  );
}

// ─── Chart Mock Data ──────────────────────────────────────────────────────────
type ChartPeriod = 7 | 30 | 90;

const chartData: Record<ChartPeriod, { date: string; glucose: number; carbs: number; avgGlucose?: number }[]> = {
  7: [
    { date: "Apr 24", glucose: 118, carbs: 52 },
    { date: "Apr 25", glucose: 142, carbs: 68 },
    { date: "Apr 26", glucose: 103, carbs: 45 },
    { date: "Apr 27", glucose: 137, carbs: 71 },
    { date: "Apr 28", glucose: 125, carbs: 58 },
    { date: "Apr 29", glucose: 151, carbs: 80 },
    { date: "Apr 30", glucose: 112, carbs: 65 },
  ],
  30: [
    { date: "Apr 1",  glucose: 108, carbs: 48 },
    { date: "Apr 3",  glucose: 121, carbs: 55 },
    { date: "Apr 5",  glucose: 134, carbs: 63 },
    { date: "Apr 7",  glucose: 119, carbs: 50 },
    { date: "Apr 9",  glucose: 145, carbs: 72 },
    { date: "Apr 11", glucose: 128, carbs: 58 },
    { date: "Apr 13", glucose: 116, carbs: 47 },
    { date: "Apr 15", glucose: 139, carbs: 66 },
    { date: "Apr 17", glucose: 122, carbs: 54 },
    { date: "Apr 19", glucose: 148, carbs: 75 },
    { date: "Apr 21", glucose: 131, carbs: 61 },
    { date: "Apr 23", glucose: 114, carbs: 49 },
    { date: "Apr 25", glucose: 142, carbs: 68 },
    { date: "Apr 27", glucose: 137, carbs: 71 },
    { date: "Apr 30", glucose: 112, carbs: 65 },
  ],
  90: [
    { date: "Feb 2",  glucose: 138, carbs: 67 },
    { date: "Feb 9",  glucose: 145, carbs: 72 },
    { date: "Feb 16", glucose: 132, carbs: 60 },
    { date: "Feb 23", glucose: 141, carbs: 68 },
    { date: "Mar 2",  glucose: 129, carbs: 58 },
    { date: "Mar 9",  glucose: 136, carbs: 63 },
    { date: "Mar 16", glucose: 124, carbs: 55 },
    { date: "Mar 23", glucose: 133, carbs: 62 },
    { date: "Mar 30", glucose: 127, carbs: 57 },
    { date: "Apr 6",  glucose: 131, carbs: 61 },
    { date: "Apr 13", glucose: 118, carbs: 51 },
    { date: "Apr 20", glucose: 135, carbs: 64 },
    { date: "Apr 30", glucose: 112, carbs: 65 },
  ],
};

function getPeriodStats(data: typeof chartData[7]) {
  const glucoseVals = data.map(d => d.glucose);
  const carbVals    = data.map(d => d.carbs);
  const avg   = Math.round(glucoseVals.reduce((a, b) => a + b, 0) / glucoseVals.length);
  const max   = Math.max(...glucoseVals);
  const min   = Math.min(...glucoseVals);
  const inRange = glucoseVals.filter(v => v >= 70 && v <= 140).length;
  const tir   = Math.round((inRange / glucoseVals.length) * 100);
  const avgCarbs = Math.round(carbVals.reduce((a, b) => a + b, 0) / carbVals.length);
  const trend: "up" | "down" | "stable" =
    glucoseVals[glucoseVals.length - 1] > glucoseVals[0] + 5 ? "up"
    : glucoseVals[glucoseVals.length - 1] < glucoseVals[0] - 5 ? "down"
    : "stable";
  return { avg, max, min, tir, avgCarbs, trend };
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────
const GlucoseChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val > 140 ? "#ef4444" : val < 70 ? "#3b82f6" : "#10b981";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p style={{ color, fontWeight: 700 }}>{val} <span className="text-slate-400 font-normal">mg/dL</span></p>
      <p className="text-slate-400 mt-0.5">
        {val > 140 ? "Above range" : val < 70 ? "Below range" : "In range ✓"}
      </p>
    </div>
  );
};

const CarbsChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-emerald-700 font-bold">{payload[0].value} <span className="text-slate-400 font-normal">g carbs</span></p>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState<"glucose" | "meal" | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>(initialActivity);
  const [notifRead, setNotifRead] = useState<number[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>(7);
  const [doctorNotes, setDoctorNotes] = useState<ClinicalNote[]>([]);

  useEffect(() => {
    setDoctorNotes(loadDoctorNotes());
    const onStorage = () => setDoctorNotes(loadDoctorNotes());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const addLog = (log: ActivityLog) => {
    setActivity((prev) => [log, ...prev].slice(0, 10));
  };

  const markRead = (id: number) => setNotifRead((r) => [...r, id]);
  const markAllRead = () => setNotifRead(notifications.map((n) => n.id));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const unreadCount = notifications.filter((n) => n.unread && !notifRead.includes(n.id)).length;

  // Latest glucose from activity
  const latestGlucose = activity.find((a) => a.type === "glucose");
  const latestMeal = activity.find((a) => a.type === "meal");

  // Derive condition status from latest glucose
  const conditionStatus: ConditionStatus = latestGlucose
    ? parseFloat(latestGlucose.detail) >= 140
      ? "Critical"
      : parseFloat(latestGlucose.detail) >= 110
      ? "Mid"
      : "Low"
    : "Low";

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
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
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig[conditionStatus].dot}`} />
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
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal("glucose")}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Quick Log
            </button>
            <div className="relative">
              
            </div>
          </div>
        </header>

        {/* Scrollable body */}
        <main className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* ── Greeting ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.02em" }}>
                  {greeting}, {firstName}! 👋
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Here's your health snapshot for today — Thursday, April 30, 2026
                </p>
              </div>
              <div className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm ${statusConfig[conditionStatus].bg} ${statusConfig[conditionStatus].text} ${statusConfig[conditionStatus].border}`} style={{ fontWeight: 600 }}>
                <span className={`w-2 h-2 rounded-full ${statusConfig[conditionStatus].dot}`} />
                {statusConfig[conditionStatus].label}
              </div>
            </div>

            {/* ── Summary Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Latest Glucose */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Droplets className="w-6 h-6 text-blue-500" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs mb-0.5">Latest Glucose</p>
                  <p className="text-slate-900" style={{ fontWeight: 800, fontSize: "1.75rem", lineHeight: 1 }}>
                    {latestGlucose ? latestGlucose.detail.split(" ")[0] : "—"}
                  </p>
                  <p className="text-slate-400 text-xs mt-1 truncate">
                    {latestGlucose ? `mg/dL · ${latestGlucose.time}` : "No reading yet"}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {latestGlucose?.trend === "up" ? (
                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-red-400" />
                    </div>
                  ) : latestGlucose?.trend === "down" ? (
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4 text-blue-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Minus className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Last Meal */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Utensils className="w-6 h-6 text-emerald-500" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs mb-0.5">Last Meal</p>
                  <p className="text-slate-900 truncate" style={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }}>
                    {latestMeal ? latestMeal.title.replace(" Logged", "") : "Not logged"}
                  </p>
                  <p className="text-slate-400 text-xs mt-1 truncate">
                    {latestMeal ? latestMeal.detail : "No meal yet"}
                  </p>
                </div>
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              {/* Condition Status */}
              <div className={`rounded-2xl p-5 border shadow-sm flex items-center gap-4 ${statusConfig[conditionStatus].bg} ${statusConfig[conditionStatus].border}`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/60">
                  <Activity className={`w-6 h-6 ${statusConfig[conditionStatus].text}`} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs mb-0.5 ${statusConfig[conditionStatus].text} opacity-70`}>Condition Status</p>
                  <p className={`${statusConfig[conditionStatus].text}`} style={{ fontWeight: 800, fontSize: "1.3rem", lineHeight: 1 }}>
                    {statusConfig[conditionStatus].label}
                  </p>
                  <p className={`text-xs mt-1 ${statusConfig[conditionStatus].text} opacity-60`}>
                    Based on recent readings
                  </p>
                </div>
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                  <span className={`w-3 h-3 rounded-full ${statusConfig[conditionStatus].dot} animate-pulse`} />
                </div>
              </div>
            </div>

            {/* ── Quick Actions ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setModal("glucose")}
                className="group flex flex-col items-center gap-3 bg-white hover:bg-blue-600 border border-slate-100 hover:border-blue-600 rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 bg-blue-50 group-hover:bg-white/20 rounded-2xl flex items-center justify-center transition-colors">
                  <Droplets className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" strokeWidth={1.8} />
                </div>
                <span className="text-slate-700 group-hover:text-white text-sm transition-colors" style={{ fontWeight: 600 }}>Log Glucose</span>
              </button>

              <button
                onClick={() => setModal("meal")}
                className="group flex flex-col items-center gap-3 bg-white hover:bg-emerald-600 border border-slate-100 hover:border-emerald-600 rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 bg-emerald-50 group-hover:bg-white/20 rounded-2xl flex items-center justify-center transition-colors">
                  <Utensils className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors" strokeWidth={1.8} />
                </div>
                <span className="text-slate-700 group-hover:text-white text-sm transition-colors" style={{ fontWeight: 600 }}>Log Meal</span>
              </button>
            </div>

            {/* ── Health Trends Charts ──────────────────────────────────────── */}
            {(() => {
              const data  = chartData[chartPeriod];
              const stats = getPeriodStats(data);
              return (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Header + Period Toggle */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-50 flex-wrap gap-3">
                    <div>
                      <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Health Trends</h2>
                      <p className="text-slate-400 text-xs mt-0.5">Glucose & nutrition overview</p>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                      {([7, 30, 90] as ChartPeriod[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setChartPeriod(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            chartPeriod === p
                              ? "bg-white text-blue-700 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {p}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stat Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-50">
                    {[
                      {
                        label: "Avg Glucose",
                        value: `${stats.avg} mg/dL`,
                        color: stats.avg > 140 ? "text-red-600" : stats.avg < 70 ? "text-blue-600" : "text-emerald-600",
                        bg:    stats.avg > 140 ? "bg-red-50"   : stats.avg < 70 ? "bg-blue-50"   : "bg-emerald-50",
                      },
                      {
                        label: "Time In Range",
                        value: `${stats.tir}%`,
                        color: stats.tir >= 70 ? "text-emerald-600" : stats.tir >= 50 ? "text-amber-600" : "text-red-600",
                        bg:    stats.tir >= 70 ? "bg-emerald-50"    : stats.tir >= 50 ? "bg-amber-50"    : "bg-red-50",
                      },
                      {
                        label: "Peak Glucose",
                        value: `${stats.max} mg/dL`,
                        color: stats.max > 180 ? "text-red-600" : "text-amber-600",
                        bg:    stats.max > 180 ? "bg-red-50"    : "bg-amber-50",
                      },
                      {
                        label: "Avg Daily Carbs",
                        value: `${stats.avgCarbs}g`,
                        color: "text-blue-600",
                        bg:    "bg-blue-50",
                      },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={`px-5 py-3.5 border-r last:border-r-0 border-slate-50 ${bg}`}>
                        <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                        <p className={`text-sm ${color}`} style={{ fontWeight: 700 }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Glucose Trend Chart ── */}
                  <div className="px-5 pt-5 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Droplets className="w-4 h-4 text-blue-500" strokeWidth={1.8} />
                      <span className="text-slate-700 text-sm" style={{ fontWeight: 600 }}>Glucose Trend</span>
                      <span className="text-slate-300 text-xs ml-auto">Target: 70–140 mg/dL</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          interval={chartPeriod === 7 ? 0 : chartPeriod === 30 ? 2 : 2}
                        />
                        <YAxis
                          domain={[60, 200]}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickCount={5}
                        />
                        <Tooltip content={<GlucoseChartTooltip />} />
                        <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
                          label={{ value: "High", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                        <ReferenceLine y={70}  stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1.5}
                          label={{ value: "Low",  position: "right", fontSize: 10, fill: "#3b82f6" }} />
                        <Area
                          type="monotone"
                          dataKey="glucose"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fill="url(#glucoseGrad)"
                          dot={{ r: chartPeriod === 7 ? 4 : 2, fill: "#3b82f6", strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    {/* Range legend */}
                    <div className="flex items-center gap-4 mt-1 justify-center">
                      {[
                        { color: "bg-emerald-500", label: "In range (70–140)" },
                        { color: "bg-amber-400",   label: "High (>140)" },
                        { color: "bg-blue-400",    label: "Low (<70)" },
                      ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                          <span className="text-slate-400 text-xs">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Daily Carbs Chart ── */}
                  <div className="px-5 pt-4 pb-5 border-t border-slate-50 mt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Utensils className="w-4 h-4 text-emerald-500" strokeWidth={1.8} />
                      <span className="text-slate-700 text-sm" style={{ fontWeight: 600 }}>
                        {chartPeriod === 7 ? "Daily" : "Per-Entry"} Carb Intake
                      </span>
                      <span className="text-slate-300 text-xs ml-auto">Recommended: ≤ 60g / meal</span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={chartPeriod === 90 ? 10 : chartPeriod === 30 ? 12 : 24}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          interval={chartPeriod === 7 ? 0 : chartPeriod === 30 ? 2 : 2}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickCount={4}
                          domain={[0, 120]}
                        />
                        <Tooltip content={<CarbsChartTooltip />} />
                        <ReferenceLine y={60} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5}
                          label={{ value: "Target", position: "right", fontSize: 10, fill: "#10b981" }} />
                        <Bar
                          dataKey="carbs"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          opacity={0.8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* ── Doctor's Notes ────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-blue-50">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Notes from Your Doctor</h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {doctorNotes.length > 0
                      ? `${doctorNotes.length} note${doctorNotes.length > 1 ? "s" : ""} from your care team`
                      : "Messages from your care team will appear here"}
                  </p>
                </div>
              </div>

              {doctorNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                    <FileText className="w-5 h-5 text-blue-300" strokeWidth={1.8} />
                  </div>
                  <p className="text-slate-500 text-sm" style={{ fontWeight: 600 }}>No notes yet</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
                    Your doctor hasn't left any notes yet. Clinical notes and recommendations will show up here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-blue-50">
                  {doctorNotes.map(note => {
                    const priorityCfg = {
                      routine:  { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   border: "border-blue-200"   },
                      urgent:   { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500",  border: "border-amber-200"  },
                      critical: { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    border: "border-red-200"    },
                    }[note.priority];
                    return (
                      <div key={note.id} className={`px-5 py-4 ${note.priority === "critical" ? "bg-red-50/30" : note.priority === "urgent" ? "bg-amber-50/20" : ""}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${priorityCfg.bg} border ${priorityCfg.border}`}>
                            <span className={`w-2 h-2 rounded-full ${priorityCfg.dot}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className="text-slate-800 text-xs" style={{ fontWeight: 600 }}>{note.doctorName}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-semibold ${priorityCfg.bg} ${priorityCfg.text}`}>
                                {note.priority}
                              </span>
                              <span className="text-slate-400 text-xs flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />{note.date} · {note.time}
                              </span>
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">{note.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Bottom Row: Activity Feed ──────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-50">
                <div>
                  <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Recent Activity</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Last {Math.min(activity.length, 5)} logs</p>
                </div>
                <button className="text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors">View all</button>
              </div>

              <div className="divide-y divide-slate-50">
                {activity.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <ActivityIcon type={log.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm truncate" style={{ fontWeight: 600 }}>{log.title}</p>
                      <p className="text-slate-400 text-xs truncate mt-0.5">{log.detail}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {log.trend === "up" && <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />}
                      {log.trend === "down" && <ArrowDownRight className="w-3.5 h-3.5 text-blue-400" />}
                      <span className="text-slate-300 text-xs whitespace-nowrap">{log.time}</span>
                    </div>
                  </div>
                ))}

                {activity.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    No activity yet. Use the quick actions above to get started.
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modal === "glucose" && (
        <LogGlucoseModal onClose={() => setModal(null)} onSave={(log) => { addLog(log); }} />
      )}
      {modal === "meal" && (
        <LogMealModal onClose={() => setModal(null)} onSave={(log) => { addLog(log); }} />
      )}
    </div>
  );
}