import { useState } from "react";
import { useNavigate } from "react-router";
import { Navbar } from "../components/Navbar";
import { HeroSection } from "../components/HeroSection";
import { FeaturesSection } from "../components/FeaturesSection";
import { Footer } from "../components/Footer";

export default function LandingPage() {
  const navigate = useNavigate();

  const handleOpenTest = () => navigate("/diabetes-test");

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection onOpenTest={handleOpenTest} />

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-1.5 rounded-full text-xs font-medium mb-4">
              Simple Process
            </div>
            <h2
              className="text-slate-900 mb-4"
              style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              Start in Under 2 Minutes
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              No medical background needed. Our guided process makes health screening simple and accessible for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {[
              { step: "01", title: "Take the Screening", desc: "Answer 5 simple questions about your age, weight, blood glucose, and lifestyle in under 2 minutes.", color: "blue" },
              { step: "02", title: "Get Instant Results", desc: "Our AI processes your answers immediately and gives you a clear risk assessment with explanation.", color: "teal" },
              { step: "03", title: "Track & Improve", desc: "Sign up to monitor your health over time, log daily metrics, and receive personalized guidance.", color: "emerald" },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg ${color === "blue" ? "bg-gradient-to-br from-blue-500 to-blue-600" : color === "teal" ? "bg-gradient-to-br from-teal-400 to-teal-600" : "bg-gradient-to-br from-emerald-400 to-emerald-600"}`}>
                  <span className="text-white text-2xl" style={{ fontWeight: 800 }}>{step}</span>
                </div>
                <h3 className="text-slate-900 mb-3" style={{ fontWeight: 700, fontSize: "1.1rem" }}>{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <button
              onClick={handleOpenTest}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-semibold text-base shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:shadow-blue-300"
            >
              Take the Free Diabetes Test
              <span>→</span>
            </button>
            
          </div>
        </div>
      </section>

      <FeaturesSection />

      {/* Testimonials / Stats */}
      

      <Footer />

    </div>
  );
}