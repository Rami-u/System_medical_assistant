import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, Droplets, Utensils,
  Settings, LogOut, Menu, X, Trash2, Brain, Info,
  Loader2, Clock, Camera, Upload, CheckCircle,
  AlertTriangle, RefreshCw, Plus, Minus, Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type MealType   = "breakfast" | "lunch" | "dinner" | "snack";
type ScanStage  = "idle" | "preview" | "scanning" | "detected";

interface DetectedFood {
  name: string;
  carbs: number;
  unit: string;
  confidence: number; // 0-100
}

interface MealEntry {
  id: string;
  mealType: MealType;
  label: string;
  foods: DetectedFood[];
  carbEstimate: number;
  time: string;
  date: string;
  imageUrl: string;
}

// ─── Mock AI detection library ────────────────────────────────────────────────
const MOCK_DETECTIONS = [
  {
    mealType: "lunch" as MealType,
    label: "Chicken & Rice Bowl",
    foods: [
      { name: "White Rice",           carbs: 45, unit: "1 cup",     confidence: 94 },
      { name: "Grilled Chicken",       carbs: 0,  unit: "150g",     confidence: 91 },
      { name: "Mixed Green Salad",     carbs: 4,  unit: "side",     confidence: 87 },
    ],
  },
  {
    mealType: "breakfast" as MealType,
    label: "Oat & Fruit Breakfast",
    foods: [
      { name: "Oatmeal",       carbs: 27, unit: "1 cup",    confidence: 96 },
      { name: "Banana",        carbs: 27, unit: "1 medium", confidence: 93 },
      { name: "Greek Yogurt",  carbs: 9,  unit: "½ cup",    confidence: 88 },
    ],
  },
  {
    mealType: "dinner" as MealType,
    label: "Pasta & Chicken",
    foods: [
      { name: "Pasta (cooked)",    carbs: 43, unit: "1 cup",  confidence: 95 },
      { name: "Tomato Sauce",      carbs: 12, unit: "½ cup",  confidence: 90 },
      { name: "Chicken Breast",    carbs: 0,  unit: "100g",   confidence: 86 },
    ],
  },
  {
    mealType: "snack" as MealType,
    label: "Fruit & Dates Snack",
    foods: [
      { name: "Apple",  carbs: 25, unit: "1 medium",  confidence: 97 },
      { name: "Dates",  carbs: 18, unit: "3 pieces",  confidence: 89 },
    ],
  },
  {
    mealType: "lunch" as MealType,
    label: "Rice & Lentil Plate",
    foods: [
      { name: "Brown Rice",        carbs: 38, unit: "1 cup",   confidence: 92 },
      { name: "Lentils (cooked)",  carbs: 40, unit: "½ cup",   confidence: 88 },
      { name: "Flatbread",         carbs: 28, unit: "1 piece", confidence: 85 },
    ],
  },
  {
    mealType: "breakfast" as MealType,
    label: "Eggs & Toast",
    foods: [
      { name: "Eggs (scrambled)",    carbs: 2,  unit: "2 large",  confidence: 98 },
      { name: "Whole Wheat Bread",   carbs: 24, unit: "2 slices", confidence: 94 },
      { name: "Orange Juice",        carbs: 26, unit: "1 cup",    confidence: 91 },
    ],
  },
  {
    mealType: "dinner" as MealType,
    label: "Salmon & Veggies",
    foods: [
      { name: "Salmon",           carbs: 0,  unit: "150g",   confidence: 96 },
      { name: "Sweet Potato",     carbs: 26, unit: "1 medium", confidence: 92 },
      { name: "Corn",             carbs: 27, unit: "½ cup",  confidence: 86 },
    ],
  },
  {
    mealType: "lunch" as MealType,
    label: "Sandwich & Juice",
    foods: [
      { name: "Whole Wheat Bread", carbs: 24, unit: "2 slices", confidence: 95 },
      { name: "Tuna (canned)",     carbs: 0,  unit: "100g",     confidence: 91 },
      { name: "Orange Juice",      carbs: 26, unit: "1 cup",    confidence: 88 },
    ],
  },
];

const SCAN_STEPS = [
  { label: "Processing image…",         icon: "📸" },
  { label: "Scanning for food items…",  icon: "🔍" },
  { label: "Estimating portion sizes…", icon: "⚖️" },
  { label: "Calculating carbohydrates…",icon: "🧮" },
  { label: "Finalising analysis…",      icon: "✅" },
];

const mealTypeEmoji: Record<MealType, string> = {
  breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎",
};

const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard/patient" },
  { icon: Droplets,        label: "Glucose Logs", path: "/dashboard/patient/glucose" },
  { icon: Utensils,        label: "Meal Logs",    path: "/dashboard/patient/meals", active: true },
  { icon: Sparkles,        label: "AI Assistant", path: "/dashboard/patient/ai-chat" },
  { icon: Settings,        label: "Settings",     path: "/dashboard/patient/settings" },
];

const todayStr    = new Date().toISOString().split("T")[0];
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];

// ─── Pre-seeded history ───────────────────────────────────────────────────────
const SAMPLE_MEALS: MealEntry[] = [
  {
    id: "s1", mealType: "breakfast", label: "Oat & Fruit Breakfast",
    foods: [
      { name: "Oatmeal", carbs: 27, unit: "1 cup", confidence: 96 },
      { name: "Banana",  carbs: 27, unit: "1 medium", confidence: 93 },
    ],
    carbEstimate: 54, time: "08:10", date: todayStr,
    imageUrl: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400&q=80",
  },
  {
    id: "s2", mealType: "lunch", label: "Chicken & Rice Bowl",
    foods: [
      { name: "White Rice",       carbs: 45, unit: "1 cup", confidence: 94 },
      { name: "Grilled Chicken",  carbs: 0,  unit: "150g",  confidence: 91 },
    ],
    carbEstimate: 45, time: "13:00", date: todayStr,
    imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80",
  },
  {
    id: "s3", mealType: "dinner", label: "Pasta & Chicken",
    foods: [
      { name: "Pasta (cooked)", carbs: 43, unit: "1 cup", confidence: 95 },
      { name: "Tomato Sauce",   carbs: 12, unit: "½ cup", confidence: 90 },
    ],
    carbEstimate: 55, time: "19:30", date: yesterdayStr,
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&q=80",
  },
];

// ─── Camera Modal ─────────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null);
  const [camError, setCamError]   = useState("");
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStreamRef(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setReady(true);
          };
        }
      })
      .catch(() => setCamError("Camera access was denied or is unavailable on this device."));
    return () => {
      active = false;
    };
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => { streamRef?.getTracks().forEach((t) => t.stop()); };
  }, [streamRef]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    streamRef?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Camera className="w-4 h-4 text-emerald-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Camera Capture</h3>
              <p className="text-slate-400 text-xs">Position your meal in frame, then capture</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative bg-slate-900 aspect-video flex items-center justify-center">
          {camError ? (
            <div className="text-center px-6 py-10">
              <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Camera className="w-7 h-7 text-slate-500" strokeWidth={1.5} />
              </div>
              <p className="text-slate-300 text-sm mb-1" style={{ fontWeight: 600 }}>Camera Unavailable</p>
              <p className="text-slate-500 text-xs mb-4">{camError}</p>
              <button onClick={onClose} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
                Upload a Photo Instead
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Corner guides */}
              {ready && (
                <>
                  <div className="absolute inset-6 pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
                  </div>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/40 px-3 py-1 rounded-full">
                    Position your meal within the frame
                  </div>
                </>
              )}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture button */}
        {!camError && (
          <div className="px-5 py-4 flex items-center justify-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCapture}
              disabled={!ready}
              className="flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-emerald-200"
            >
              <Camera className="w-4 h-4" />
              Capture Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scan Progress overlay ────────────────────────────────────────────────────
function ScanOverlay({ step }: { step: number }) {
  return (
    <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl z-10">
      <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-5 shadow-xl shadow-emerald-900/40 animate-pulse">
        <Brain className="w-8 h-8 text-white" strokeWidth={1.8} />
      </div>
      <p className="text-white text-sm mb-5" style={{ fontWeight: 700 }}>Analysing your meal…</p>
      <div className="w-56 space-y-2">
        {SCAN_STEPS.map((s, i) => (
          <div key={i} className={`flex items-center gap-2.5 transition-all duration-300 ${i < step ? "opacity-100" : "opacity-30"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${i < step ? "bg-emerald-500" : "bg-white/20"}`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <span className="text-white/50 text-[10px]">{i + 1}</span>}
            </div>
            <span className="text-xs" style={{ color: i < step ? "white" : "rgba(255,255,255,0.4)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MealLogsPage() {
  const { user, signOut } = useAuth();
  const navigate          = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Capture flow state
  const [scanStage,    setScanStage]    = useState<ScanStage>("idle");
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [scanStep,     setScanStep]     = useState(0);
  const [detected,     setDetected]     = useState<typeof MOCK_DETECTIONS[0] | null>(null);
  const [editedFoods,  setEditedFoods]  = useState<DetectedFood[]>([]);
  const [selectedType, setSelectedType] = useState<MealType>("lunch");
  const [showCamera,   setShowCamera]   = useState(false);
  const [isDragging,   setIsDragging]   = useState(false);

  // ── History
  const [mealEntries,  setMealEntries]  = useState<MealEntry[]>(SAMPLE_MEALS);

  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);

  const handleSignOut = () => { signOut(); navigate("/"); };

  // ─── Image input handler (shared for upload & camera file fallback)
  const handleImageFile = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScanStage("preview");
    setScanStep(0);
    setDetected(null);
    setEditedFoods([]);
  }, []);

  // ─── Drag & drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageFile(e.dataTransfer.files[0] ?? null);
  };

  // ─── Camera capture callback
  const handleCameraCapture = (dataUrl: string) => {
    setPreviewUrl(dataUrl);
    setScanStage("preview");
    setScanStep(0);
    setDetected(null);
    setEditedFoods([]);
    setShowCamera(false);
  };

  // ─── Run AI scan
  const handleScan = async () => {
    if (!previewUrl) return;
    setScanStage("scanning");

    // Animate steps
    for (let i = 1; i <= SCAN_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 480));
      setScanStep(i);
    }
    await new Promise((r) => setTimeout(r, 300));

    // Pick a random mock detection
    const result = MOCK_DETECTIONS[Math.floor(Math.random() * MOCK_DETECTIONS.length)];
    setDetected(result);
    setEditedFoods(result.foods.map((f) => ({ ...f })));
    setSelectedType(result.mealType);
    setScanStage("detected");
  };

  // ─── Edit detected carbs inline
  const updateCarbs = (idx: number, val: string) => {
    setEditedFoods((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, carbs: Math.max(0, parseInt(val) || 0) } : f))
    );
  };

  const removeFood = (idx: number) => {
    setEditedFoods((prev) => prev.filter((_, i) => i !== idx));
  };

  // ─── Log the meal
  const handleLogMeal = () => {
    if (!previewUrl || !detected) return;
    const carbEstimate = editedFoods.reduce((s, f) => s + f.carbs, 0);
    const nowTime = new Date().toTimeString().slice(0, 5);
    setMealEntries((prev) => [
      {
        id: `m${Date.now()}`,
        mealType: selectedType,
        label: detected.label,
        foods: editedFoods,
        carbEstimate,
        time: nowTime,
        date: todayStr,
        imageUrl: previewUrl,
      },
      ...prev,
    ]);
    // Reset capture flow
    setPreviewUrl(null);
    setScanStage("idle");
    setDetected(null);
    setEditedFoods([]);
    setScanStep(0);
  };

  // ─── Remove a meal from history
  const removeMeal = (id: string) => setMealEntries((p) => p.filter((m) => m.id !== id));

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
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {sidebarNav.map(({ icon: Icon, label, path, active }) => (
          <button key={label} onClick={() => path && navigate(path)}
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
  );

  const totalCarbsToday = mealEntries.filter(m => m.date === todayStr).reduce((s, m) => s + m.carbEstimate, 0);

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <Sidebar />

      {/* Hidden file inputs */}
      <input ref={uploadRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)} />
      <input ref={cameraFileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-5 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Utensils className="w-4 h-4 text-emerald-600" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Meal Logs</h1>
            <p className="text-slate-400 text-xs">Thursday, May 1, 2026</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-medium">
              <Utensils className="w-3 h-3" />Today: {totalCarbsToday}g carbs
            </div>
            <button onClick={() => navigate("/dashboard/patient/glucose")}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors font-medium">
              <Droplets className="w-3.5 h-3.5" /> Glucose Logs
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* ── Left: Photo capture (3 cols) ── */}
              <div className="lg:col-span-3 space-y-5">

                {/* ── Capture Zone ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-slate-50">
                    <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Camera className="w-4 h-4 text-emerald-600" strokeWidth={1.8} />
                    </div>
                    <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Capture Meal Photo</h2>
                    <span className="ml-auto text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">AI-Powered</span>
                  </div>

                  <div className="p-5">
                    {/* ── IDLE: Upload zone ── */}
                    {scanStage === "idle" && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 ${isDragging ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50"}`}
                      >
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                            <Utensils className="w-7 h-7 text-emerald-500" strokeWidth={1.5} />
                          </div>
                          <p className="text-slate-800 mb-1" style={{ fontWeight: 700 }}>Snap or upload your meal</p>
                          <p className="text-slate-400 text-xs mb-6 max-w-xs">
                            Our AI will identify the foods and estimate carbohydrate content automatically
                          </p>

                          <div className="flex gap-3">
                            {/* Camera button */}
                            <button
                              onClick={() => {
                                // Try getUserMedia on desktop, file capture on mobile
                                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                                  setShowCamera(true);
                                } else {
                                  cameraFileRef.current?.click();
                                }
                              }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-emerald-200"
                            >
                              <Camera className="w-4 h-4" />Take Photo
                            </button>

                            {/* Upload button */}
                            <button
                              onClick={() => uploadRef.current?.click()}
                              className="flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 rounded-xl text-sm font-semibold transition-colors"
                            >
                              <Upload className="w-4 h-4" />Upload Photo
                            </button>
                          </div>

                          <p className="text-slate-300 text-xs mt-4">or drag & drop an image here</p>
                          <p className="text-slate-300 text-xs mt-1">Supports JPG, PNG, HEIC, WEBP</p>
                        </div>
                      </div>
                    )}

                    {/* ── PREVIEW: Image shown, waiting to scan ── */}
                    {scanStage === "preview" && previewUrl && (
                      <div className="space-y-4">
                        <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video">
                          <img src={previewUrl} alt="Meal preview" className="w-full h-full object-cover" />
                          <div className="absolute top-3 right-3">
                            <button
                              onClick={() => { setScanStage("idle"); setPreviewUrl(null); }}
                              className="w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-3 left-3 right-3">
                            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <p className="text-white text-xs">Ready to analyse · AI will identify foods and estimate carbs</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setScanStage("idle"); setPreviewUrl(null); }}
                            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                          >
                            Retake
                          </button>
                          <button
                            onClick={handleScan}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-emerald-200"
                          >
                            <Brain className="w-4 h-4" />Analyse with AI
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── SCANNING: Animated progress ── */}
                    {scanStage === "scanning" && previewUrl && (
                      <div className="relative rounded-2xl overflow-hidden aspect-video">
                        <img src={previewUrl} alt="Scanning" className="w-full h-full object-cover opacity-40" />
                        <ScanOverlay step={scanStep} />
                      </div>
                    )}

                    {/* ── DETECTED: Results ── */}
                    {scanStage === "detected" && detected && (
                      <div className="space-y-4">
                        {/* Image + detected badge */}
                        <div className="relative rounded-2xl overflow-hidden aspect-video">
                          <img src={previewUrl!} alt="Analysed meal" className="w-full h-full object-cover" />
                          <div className="absolute top-3 left-3">
                            <div className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {editedFoods.length} food item{editedFoods.length !== 1 ? "s" : ""} detected
                            </div>
                          </div>
                          <button
                            onClick={() => { setScanStage("idle"); setPreviewUrl(null); }}
                            className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Detected meal label + type selector */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>{detected.label}</p>
                            <p className="text-slate-400 text-xs">AI-detected · review and confirm</p>
                          </div>
                          <div className="flex gap-1.5">
                            {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((t) => (
                              <button
                                key={t}
                                onClick={() => setSelectedType(t)}
                                title={t}
                                className={`w-9 h-9 rounded-xl border-2 text-base flex items-center justify-center transition-all ${selectedType === t ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
                              >
                                {mealTypeEmoji[t]}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Detected foods — editable */}
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-semibold">Detected Items <span className="text-slate-300 font-normal">(tap carbs to edit)</span></p>
                          {editedFoods.map((food, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-slate-800 text-sm" style={{ fontWeight: 600 }}>{food.name}</p>
                                  <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-full font-medium">{food.confidence}% sure</span>
                                </div>
                                <p className="text-slate-400 text-xs">{food.unit}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={food.carbs}
                                    onChange={(e) => updateCarbs(idx, e.target.value)}
                                    min={0} max={200}
                                    className="w-14 px-2 py-1.5 text-center text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                                    style={{ fontWeight: 600 }}
                                  />
                                  <span className="text-xs text-slate-400">g</span>
                                </div>
                                <button onClick={() => removeFood(idx)} className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {editedFoods.length === 0 && (
                            <div className="text-center py-4 text-slate-400 text-sm">
                              All items removed. <button onClick={handleScan} className="text-emerald-600 font-semibold hover:underline">Re-scan?</button>
                            </div>
                          )}
                        </div>

                        {/* Total + confirm */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-emerald-600 text-xs mb-0.5">Estimated Total Carbs</p>
                            <p className="text-emerald-800 text-xl" style={{ fontWeight: 800 }}>
                              {editedFoods.reduce((s, f) => s + f.carbs, 0)}g
                            </p>
                          </div>
                          <button
                            onClick={handleLogMeal}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-emerald-200"
                          >
                            <CheckCircle className="w-4 h-4" />Log This Meal
                          </button>
                        </div>

                        <button onClick={() => { setScanStage("idle"); setPreviewUrl(null); }}
                          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                          <RefreshCw className="w-3 h-3" />Discard and start over
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ── Right: Meal history (2 cols) ── */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden lg:sticky lg:top-0">
                  <div className="px-5 pt-5 pb-4 border-b border-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Meal History</h2>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg font-medium">{mealEntries.length} logged</span>
                    </div>
                    {mealEntries.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                          <p className="text-emerald-400 text-[10px] mb-0.5">Total Carbs</p>
                          <p className="text-emerald-700 text-sm" style={{ fontWeight: 700 }}>
                            {mealEntries.reduce((s, m) => s + m.carbEstimate, 0)}g
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                          <p className="text-slate-400 text-[10px] mb-0.5">Avg / Meal</p>
                          <p className="text-slate-700 text-sm" style={{ fontWeight: 700 }}>
                            {Math.round(mealEntries.reduce((s, m) => s + m.carbEstimate, 0) / mealEntries.length)}g
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[calc(100vh-300px)] overflow-y-auto divide-y divide-slate-50">
                    {mealEntries.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Utensils className="w-6 h-6 text-emerald-300" strokeWidth={1.5} />
                        </div>
                        <p className="text-slate-400 text-sm">No meals logged yet</p>
                        <p className="text-slate-300 text-xs mt-1">Capture a meal photo to get started</p>
                      </div>
                    ) : (
                      mealEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition-colors group">
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 relative">
                            <img
                              src={entry.imageUrl}
                              alt={entry.label}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect fill='%23f1f5f9' width='56' height='56'/%3E%3C/svg%3E"; }}
                            />
                            <div className="absolute bottom-0.5 left-0.5 text-xs">{mealTypeEmoji[entry.mealType]}</div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-slate-800 text-sm" style={{ fontWeight: 600 }}>{entry.label}</p>
                              <button
                                onClick={() => removeMeal(entry.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">
                              {entry.foods.map((f) => f.name).join(", ")}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${entry.carbEstimate > 60 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}>
                                ~{entry.carbEstimate}g carbs
                              </span>
                              <span className="text-slate-300 text-xs flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />{entry.time}
                              </span>
                              {entry.date !== todayStr && (
                                <span className="text-slate-300 text-xs">Yesterday</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Info className="w-3 h-3" />
                      <span>Target: ≤60g carbs per meal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* Camera Modal */}
      {showCamera && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
    </div>
  );
}
