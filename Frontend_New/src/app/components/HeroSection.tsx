import { ArrowRight, Shield, Zap, Users } from "lucide-react";

const HERO_IMAGE = "https://images.unsplash.com/photo-1758691463626-0ab959babe00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGglMjB3ZWxsbmVzcyUyMGRvY3RvciUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzc3NTY5NTkzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

interface HeroSectionProps {
  onOpenTest: () => void;
}

export function HeroSection({ onOpenTest }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE}
          alt="Healthcare technology"
          className="w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-blue-950/85 to-slate-900/90" />
      </div>

      {/* Decorative orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 text-blue-300 px-4 py-1.5 rounded-full text-xs mb-8 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Health Screening — Free & Instant
          </div>

          {/* Headline */}
          <h1
            className="text-white mb-6 leading-tight"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            Know Your Health.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">
              Act Early.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-300 text-lg max-w-2xl mb-10 leading-relaxed">
            DiaCheck uses advanced AI to assess your diabetes risk in under 2 minutes. 
            Early detection saves lives — take the free screening test today and understand 
            your health before symptoms appear.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-14">
            <button
              onClick={onOpenTest}
              className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-4 rounded-2xl font-semibold text-base shadow-lg shadow-blue-900/40 transition-all duration-200 hover:shadow-blue-800/50 hover:shadow-xl hover:-translate-y-0.5"
            >
              Take the Diabetes Test
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#features"
              className="flex items-center gap-2 text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              
              
            </a>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              
              
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              
              
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              
              
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-500">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-px h-10 bg-gradient-to-b from-slate-500 to-transparent" />
      </div>
    </section>
  );
}
