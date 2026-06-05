import { useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, Droplets, Utensils, Settings,
  LogOut, Menu, X, Upload, Loader2, Eye, AlertTriangle,
  CheckCircle, Info, Sparkles, Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { retinopathyApi, RetinopathyResult } from "../../api/retinopathyApi";

const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard",       path: "/dashboard/patient" },
  { icon: Droplets,        label: "Glucose Logs",    path: "/dashboard/patient/glucose" },
  { icon: Utensils,        label: "Meal Logs",       path: "/dashboard/patient/meals" },
  { icon: Eye,             label: "Eye Screening",   path: "/dashboard/patient/retinopathy", active: true },
  { icon: Sparkles,        label: "AI Assistant",    path: "/dashboard/patient/ai-chat" },
  { icon: Settings,        label: "Settings",        path: "/dashboard/patient/settings" },
];

const gradeColors: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  0: { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  1: { bg: "bg-lime-50",     text: "text-lime-700",    border: "border-lime-200",    dot: "bg-lime-500" },
  2: { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  3: { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500" },
  4: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500" },
};

const gradeEmoji = ["✅", "🟡", "🟠", "🔴", "🚨"];

export default function RetinopathyPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetinopathyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadRef = useRef<HTMLInputElement>(null);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const handleImageFile = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPreviewUrl(URL.createObjectURL(file));
    setImageFile(file);
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageFile(e.dataTransfer.files[0] ?? null);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await retinopathyApi.predict(imageFile);
      setResult(res);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axErr.response?.data?.detail || axErr.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setImageFile(null);
    setResult(null);
    setError(null);
  };

  const colors = result ? gradeColors[result.grade] : gradeColors[0];

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
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
            <button
              key={label}
              onClick={() => path && navigate(path)}
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-5 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
          <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-violet-600" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Eye Screening</h1>
            <p className="text-slate-400 text-xs">Diabetic Retinopathy Detection</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-3xl mx-auto space-y-5">

            {/* Disclaimer Banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={1.8} />
              <div>
                <p className="text-amber-800 text-sm" style={{ fontWeight: 600 }}>Screening Tool Disclaimer</p>
                <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                  This is an AI-powered screening tool, <strong>not a clinical diagnosis</strong>. Results should be reviewed by
                  a qualified ophthalmologist. Always consult your healthcare provider for medical decisions.
                </p>
              </div>
            </div>

            {/* Upload Zone */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-slate-50">
                <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Eye className="w-4 h-4 text-violet-600" strokeWidth={1.8} />
                </div>
                <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Upload Fundus Image</h2>
                <span className="ml-auto text-[10px] bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full font-semibold">
                  EfficientNet-B4
                </span>
              </div>

              <div className="p-5">
                <input ref={uploadRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)} />

                {!previewUrl && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 ${isDragging ? "border-violet-400 bg-violet-50/60" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50/50"}`}
                  >
                    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-100 rounded-2xl flex items-center justify-center mb-4">
                        <Eye className="w-7 h-7 text-violet-500" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-800 mb-1" style={{ fontWeight: 700 }}>Upload a retinal fundus image</p>
                      <p className="text-slate-400 text-xs mb-6 max-w-xs">
                        Our AI will analyze the image for signs of diabetic retinopathy and provide a severity grade
                      </p>
                      <button
                        onClick={() => uploadRef.current?.click()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-violet-200"
                      >
                        <Upload className="w-4 h-4" />Choose Image
                      </button>
                      <p className="text-slate-300 text-xs mt-4">or drag & drop · Supports JPEG, PNG, WebP · Max 10MB</p>
                    </div>
                  </div>
                )}

                {previewUrl && !result && (
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video">
                      <img src={previewUrl} alt="Fundus preview" className="w-full h-full object-contain bg-black" />
                      <button
                        onClick={handleReset}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button onClick={handleReset}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                        Choose Different
                      </button>
                      <button onClick={handleAnalyze} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-violet-200">
                        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</> : <><Eye className="w-4 h-4" />Analyze Image</>}
                      </button>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-5">
                    {/* Image with result badge */}
                    <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video">
                      <img src={previewUrl!} alt="Analyzed fundus" className="w-full h-full object-contain bg-black" />
                      <div className="absolute top-3 left-3">
                        <div className={`flex items-center gap-1.5 ${colors.bg} ${colors.text} text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg border ${colors.border}`}>
                          <span>{gradeEmoji[result.grade]}</span>
                          Grade {result.grade}: {result.label}
                        </div>
                      </div>
                      <button onClick={handleReset}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Result Card */}
                    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/60`}>
                          <Eye className={`w-6 h-6 ${colors.text}`} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${colors.text}`} style={{ fontWeight: 700 }}>
                            {result.label} (Grade {result.grade})
                          </p>
                          <p className={`text-xs ${colors.text} opacity-70`}>
                            Confidence: {result.confidence}%
                          </p>
                        </div>
                        <div className={`w-14 h-14 rounded-full border-4 ${colors.border} flex items-center justify-center`}>
                          <span className={`text-lg ${colors.text}`} style={{ fontWeight: 800 }}>{result.grade}</span>
                        </div>
                      </div>

                      {/* Confidence bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`${colors.text} opacity-70`}>Confidence</span>
                          <span className={`${colors.text}`} style={{ fontWeight: 600 }}>{result.confidence}%</span>
                        </div>
                        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                          <div className={`h-full ${colors.dot} rounded-full transition-all duration-700`}
                            style={{ width: `${result.confidence}%` }} />
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="bg-white/50 rounded-xl px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Info className={`w-4 h-4 ${colors.text} flex-shrink-0 mt-0.5`} strokeWidth={1.8} />
                          <div>
                            <p className={`text-xs ${colors.text}`} style={{ fontWeight: 600 }}>Recommendation</p>
                            <p className={`text-xs ${colors.text} opacity-80 mt-1 leading-relaxed`}>{result.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grade Scale */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <p className="text-slate-700 text-sm mb-3" style={{ fontWeight: 600 }}>DR Severity Scale</p>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((g) => (
                          <div key={g} className={`flex-1 rounded-lg px-2 py-2 text-center transition-all ${
                            result.grade === g
                              ? `${gradeColors[g].bg} ${gradeColors[g].border} border-2 shadow-sm`
                              : "bg-slate-50 border border-transparent"
                          }`}>
                            <p className={`text-xs ${result.grade === g ? gradeColors[g].text : "text-slate-400"}`}
                              style={{ fontWeight: result.grade === g ? 700 : 400 }}>
                              {g}
                            </p>
                            <p className={`text-[9px] mt-0.5 ${result.grade === g ? gradeColors[g].text : "text-slate-400"}`}>
                              {["None", "Mild", "Mod", "Severe", "PDR"][g]}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={handleReset}
                      className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-violet-200 flex items-center justify-center gap-2">
                      <Eye className="w-4 h-4" />Scan Another Image
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-slate-700 text-sm mb-4" style={{ fontWeight: 700 }}>How It Works</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: "1", title: "Upload", desc: "Upload a retinal fundus photograph (taken during an eye exam)", icon: Upload },
                  { step: "2", title: "AI Analysis", desc: "EfficientNet-B4 model analyzes the image using circle-crop preprocessing and 3-view TTA", icon: Eye },
                  { step: "3", title: "Results", desc: "Get severity grade (0-4), confidence score, and clinical recommendation", icon: CheckCircle },
                ].map(({ step, title, desc, icon: Icon }) => (
                  <div key={step} className="text-center">
                    <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-5 h-5 text-violet-600" strokeWidth={1.8} />
                    </div>
                    <p className="text-slate-800 text-sm" style={{ fontWeight: 600 }}>{title}</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
