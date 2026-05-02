import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Activity, Eye, EyeOff, ArrowLeft, AlertCircle, Loader2, User, Stethoscope, CheckCircle, ArrowRight } from "lucide-react";
import { useAuth, UserRole } from "../context/AuthContext";

const AUTH_IMG = "https://images.unsplash.com/photo-1738168504624-c473a1b8240a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwaGVhbHRoJTIwbW9uaXRvcmluZyUyMGRpZ2l0YWwlMjBpbnRlcmZhY2V8ZW58MXx8fHwxNzc3NTcwNDU4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

// ─── Sign In Form ──────────────────────────────────────────────────────────────
function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError("");
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.success) { setError(result.error || "Sign in failed."); return; }
    navigate(result.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient");
  };

  const handleForgot = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) { setError("Enter your email address first, then click Forgot password."); return; }
    setForgotSent(true);
    setTimeout(() => setForgotSent(false), 4000);
  };

  const handleSocial = (provider: string) => {
    // Mock social login – defaults to patient dashboard
    navigate("/dashboard/patient");
  };

  return (
    <div className="w-full">
      <h2 className="text-slate-900 mb-1" style={{ fontWeight: 800, fontSize: "1.75rem" }}>Welcome back</h2>
      <p className="text-slate-500 text-sm mb-6">Sign in to your DiaCheck account</p>

      {/* Role selector */}
      <div className="mb-6">
        <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>I am signing in as…</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "patient", icon: User,        label: "Patient",  desc: "Access my health data" },
            { value: "doctor",  icon: Stethoscope, label: "Doctor",   desc: "Manage my patients"    },
          ] as const).map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={`flex flex-col items-start p-3.5 rounded-xl border-2 transition-all text-left ${role === value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${role === value ? "bg-blue-500" : "bg-slate-100"}`}>
                <Icon className={`w-4 h-4 ${role === value ? "text-white" : "text-slate-500"}`} strokeWidth={1.8} />
              </div>
              <span className={`text-sm ${role === value ? "text-blue-700" : "text-slate-700"}`} style={{ fontWeight: 600 }}>{label}</span>
              <span className="text-xs text-slate-400 mt-0.5">{desc}</span>
            </button>
          ))}
        </div>

        {/* Demo hint per role */}
        <div className={`mt-3 px-3.5 py-2.5 rounded-xl border text-xs flex items-start gap-2 transition-all ${role === "doctor" ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
          <span className="mt-0.5 flex-shrink-0">{role === "doctor" ? "🩺" : "👤"}</span>
          <span>
            Demo {role === "doctor" ? "doctor" : "patient"} —{" "}
            <button
              type="button"
              className="underline font-semibold hover:opacity-80 transition-opacity"
              onClick={() => {
                setEmail(role === "doctor" ? "doctor@demo.com" : "patient@demo.com");
                setPassword("demo123");
              }}
            >
              Click to autofill
            </button>
            {" "}or use{" "}
            <strong>{role === "doctor" ? "doctor@demo.com" : "patient@demo.com"}</strong> / <strong>demo123</strong>
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
        {forgotSent && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-4 py-3 text-sm">
            ✓ Password reset link sent to <strong>{email}</strong>
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Password</label>
            <button type="button" onClick={handleForgot} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Don't have an account?{" "}
        <button onClick={onSwitch} className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
          Create one free
        </button>
      </p>
    </div>
  );
}

// ─── Registration Success Popup ────────────────────────────────────────────────
function RegistrationSuccessPopup({
  name,
  role,
  onContinue,
}: {
  name: string;
  role: UserRole;
  onContinue: () => void;
}) {
  const firstName = name.split(" ")[0];
  const isDoctor = role === "doctor";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden z-10">
        {/* Top gradient bar */}
        <div className={`h-1.5 w-full ${isDoctor ? "bg-gradient-to-r from-teal-400 to-teal-600" : "bg-gradient-to-r from-blue-400 to-blue-600"}`} />

        <div className="px-8 py-8 flex flex-col items-center text-center">
          {/* Animated checkmark */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isDoctor ? "bg-teal-50" : "bg-blue-50"}`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDoctor ? "bg-teal-100" : "bg-blue-100"}`}>
              <CheckCircle className={`w-8 h-8 ${isDoctor ? "text-teal-600" : "text-blue-600"}`} strokeWidth={2} />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-slate-900 mb-1.5" style={{ fontWeight: 800, fontSize: "1.4rem" }}>
            Account Created! 🎉
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-2">
            Welcome to DiaCheck, <span className="text-slate-800" style={{ fontWeight: 600 }}>{firstName}</span>!
          </p>

          {/* Role badge */}
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs mb-6 ${isDoctor ? "bg-teal-50 text-teal-700 border border-teal-100" : "bg-blue-50 text-blue-700 border border-blue-100"}`} style={{ fontWeight: 600 }}>
            {isDoctor
              ? <><Stethoscope className="w-3.5 h-3.5" /> Doctor Account</>
              : <><User className="w-3.5 h-3.5" /> Patient Account</>}
          </div>

          {/* Details */}
          <div className="w-full bg-slate-50 rounded-2xl p-4 mb-6 text-left space-y-2.5">
            {[
              isDoctor
                ? { icon: "📋", text: "Your doctor dashboard is ready with patient management tools" }
                : { icon: "📊", text: "Your personal health dashboard is set up and ready to use" },
              isDoctor
                ? { icon: "🔔", text: "You'll receive alerts when patients need attention" }
                : { icon: "💉", text: "Start logging your glucose readings and meals right away" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
                <p className="text-slate-600 text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onContinue}
            className={`w-full py-3.5 text-white rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md ${isDoctor ? "bg-teal-600 hover:bg-teal-700 shadow-teal-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"}`}
            style={{ fontWeight: 600 }}
          >
            Sign In to your account
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Register Form ─────────────────────────────────────────────────────────────
function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", dob: "", role: "patient" as UserRole });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; role: UserRole; dest: string } | null>(null);

  const update = (field: string, val: string) => setForm((f) => ({ ...f, [field]: val }));

  const validate = () => {
    if (!form.name.trim()) return "Please enter your full name.";
    if (!form.email) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Please enter a valid email address.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (!form.dob) return "Please enter your date of birth.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    const result = await register({ name: form.name, email: form.email, password: form.password, dob: form.dob, role: form.role });
    setLoading(false);
    if (!result.success) { setError(result.error || "Registration failed."); return; }
    const dest = result.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient";
    setSuccessData({ name: form.name, role: result.role!, dest });
  };

  const handleSocial = () => navigate("/dashboard/patient");

  return (
    <>
      {successData && (
        <RegistrationSuccessPopup
          name={successData.name}
          role={successData.role}
          onContinue={() => navigate("/auth?tab=signin")}
        />
      )}
      <div className="w-full">
        <h2 className="text-slate-900 mb-1" style={{ fontWeight: 800, fontSize: "1.75rem" }}>Create your account</h2>
        <p className="text-slate-500 text-sm mb-8">Join DiaCheck and take control of your health</p>

        {/* Social */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          
          
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 600 }}>I am a…</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "patient", icon: User, label: "Patient", desc: "Monitor my health" },
                { value: "doctor", icon: Stethoscope, label: "Doctor", desc: "Manage my patients" },
              ] as const).map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update("role", value)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border-2 transition-all text-left ${form.role === value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${form.role === value ? "bg-blue-500" : "bg-slate-100"}`}>
                    <Icon className={`w-4 h-4 ${form.role === value ? "text-white" : "text-slate-500"}`} strokeWidth={1.8} />
                  </div>
                  <span className={`text-sm ${form.role === value ? "text-blue-700" : "text-slate-700"}`} style={{ fontWeight: 600 }}>{label}</span>
                  <span className="text-xs text-slate-400 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
          </div>

          {/* DOB */}
          <div>
            <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Date of birth</label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => update("dob", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full px-3 py-3 pr-10 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Confirm</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirm}
                  onChange={(e) => update("confirm", e.target.value)}
                  placeholder="Repeat password"
                  className={`w-full px-3 py-3 pr-10 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all text-sm ${form.confirm && form.confirm !== form.password ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            By creating an account, you agree to our{" "}
            <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{" "}
            <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : `Create ${form.role === "doctor" ? "Doctor" : "Patient"} Account`}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <button onClick={onSwitch} className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </>
  );
}

// ─── Auth Page ─────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "register" ? "register" : "signin";

  const switchTab = (t: "signin" | "register") => setSearchParams({ tab: t });

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col overflow-hidden">
        <img src={AUTH_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/92 via-blue-950/88 to-teal-900/80" />

        {/* Decorative blobs */}
        <div className="absolute top-1/3 left-1/2 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 w-fit">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-400 rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white" style={{ fontWeight: 800, fontSize: "1.3rem" }}>
              Dia<span className="text-blue-300">Check</span>
            </span>
          </Link>

          {/* Middle content */}
          <div className="flex-1 flex flex-col justify-center max-w-sm">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-sm text-blue-200 px-3 py-1.5 rounded-full text-xs mb-6">
              AI-Powered Health Screening
            </div>
            <h2 className="text-white mb-4" style={{ fontWeight: 800, fontSize: "2rem", lineHeight: 1.2 }}>
              Your health journey<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-teal-300">
                starts right here.
              </span>
            </h2>
            

            {/* Benefits */}
            <div className="space-y-4">
              {[
                { icon: "🩺", title: "Clinical-grade risk assessment", desc: "Backed by medical research & validated algorithms" },
                { icon: "📊", title: "Real-time health monitoring", desc: "Track glucose, HbA1c, and biomarkers daily" },
                { icon: "🤖", title: "Personalised AI guidance", desc: "Get tailored advice based on your health data" },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-base flex-shrink-0 backdrop-blur-sm border border-white/10">
                    {icon}
                  </div>
                  <div>
                    <p className="text-white text-sm" style={{ fontWeight: 600 }}>{title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock glucose card */}
          
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        {/* Back link (mobile logo too) */}
        <div className="flex items-center justify-between px-6 py-5 lg:px-10 border-b border-slate-100">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to home</span>
          </Link>
          {/* Logo visible on mobile only */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-800 text-sm" style={{ fontWeight: 700 }}>
              Dia<span className="text-blue-600">Check</span>
            </span>
          </div>
          {/* Tab toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => switchTab("signin")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "signin" ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab("register")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "register" ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-start justify-center px-6 py-10 lg:px-16">
          <div className="w-full max-w-md">
            {tab === "signin" ? (
              <SignInForm onSwitch={() => switchTab("register")} />
            ) : (
              <RegisterForm onSwitch={() => switchTab("signin")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}