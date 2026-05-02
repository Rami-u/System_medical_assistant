import { useState } from "react";
import { Activity, Menu, X } from "lucide-react";
import { useNavigate } from "react-router";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const goToAuth = (tab: "signin" | "register") => {
    navigate(`/auth?tab=${tab}`);
    setMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-800 tracking-tight" style={{ fontWeight: 700, fontSize: "1.2rem" }}>
              Dia<span className="text-blue-600">Check</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => goToAuth("signin")}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors rounded-lg hover:bg-blue-50"
            >
              Sign In
            </button>
            <button
              onClick={() => goToAuth("register")}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors shadow-sm"
            >
              Register
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
          <a href="#features" className="block text-slate-600 hover:text-blue-600 text-sm py-1.5" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#how-it-works" className="block text-slate-600 hover:text-blue-600 text-sm py-1.5" onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#about" className="block text-slate-600 hover:text-blue-600 text-sm py-1.5" onClick={() => setMenuOpen(false)}>About</a>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => goToAuth("signin")}
              className="flex-1 py-2 text-sm text-blue-600 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => goToAuth("register")}
              className="flex-1 py-2 text-sm text-white bg-blue-600 font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Register
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}