import { Activity, Droplets, Brain, Bell, TrendingUp, Lock } from "lucide-react";

const features = [
  {
    icon: Activity,
    color: "blue",
    title: "Diabetes Monitoring",
    description:
      "Track your blood sugar levels, HbA1c trends, and daily metrics in real time. Get personalized dashboards that evolve as your health data grows.",
    tags: ["Blood Sugar", "HbA1c", "Daily Logs"],
  },
  {
    icon: Brain,
    color: "teal",
    title: "AI-Powered Advice",
    description:
      "Receive personalized, evidence-based health recommendations powered by advanced machine learning models trained on millions of anonymized health records.",
    tags: ["Personalized", "Evidence-Based", "ML Models"],
  },
  {
    icon: Bell,
    color: "amber",
    title: "Smart Alerts",
    description:
      "Never miss a critical health threshold. DiaCheck sends intelligent alerts when your readings deviate from safe ranges, keeping you and your doctor informed.",
    tags: ["Real-Time", "Threshold Alerts", "Doctor Sync"],
  },
  {
    icon: TrendingUp,
    color: "green",
    title: "Progress Insights",
    description:
      "Visualize your health journey with interactive charts and weekly/monthly trend reports. Celebrate milestones and identify patterns at a glance.",
    tags: ["Trends", "Reports", "Milestones"],
  },
  {
    icon: Droplets,
    color: "blue",
    title: "Glucose Logging",
    description:
      "Log fasting, post-meal, and bedtime readings effortlessly. DiaCheck automatically correlates your glucose data with meals to surface actionable patterns.",
    tags: ["Fasting", "Post-Meal", "Correlation"],
  },
  {
    icon: Lock,
    color: "purple",
    title: "Secure & Private",
    description:
      "Your health data is encrypted end-to-end and stored in compliance with HIPAA standards. You control who sees your information — always.",
    tags: ["Encrypted", "HIPAA", "Your Control"],
  },
];

const colorMap: Record<string, { bg: string; icon: string; tag: string; border: string }> = {
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    tag: "bg-blue-100 text-blue-700",
    border: "border-blue-100",
  },
  red: {
    bg: "bg-red-50",
    icon: "text-red-500",
    tag: "bg-red-100 text-red-700",
    border: "border-red-100",
  },
  teal: {
    bg: "bg-teal-50",
    icon: "text-teal-600",
    tag: "bg-teal-100 text-teal-700",
    border: "border-teal-100",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "text-amber-600",
    tag: "bg-amber-100 text-amber-700",
    border: "border-amber-100",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    tag: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-100",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    tag: "bg-purple-100 text-purple-700",
    border: "border-purple-100",
  },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-medium mb-4">
            <Activity className="w-3.5 h-3.5" />
            Everything You Need
          </div>
          <h2
            className="text-slate-900 mb-4"
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            Your Complete Health Intelligence Platform
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            DiaCheck combines cutting-edge AI with clinical-grade monitoring tools to give 
            you a 360° view of your metabolic health.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            const colors = colorMap[feature.color];
            return (
              <div
                key={feature.title}
                className={`bg-white rounded-2xl p-6 border ${colors.border} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default group`}
              >
                <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${colors.icon}`} strokeWidth={1.8} />
                </div>
                <h3 className="text-slate-900 mb-3" style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  {feature.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  {feature.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${colors.tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA strip */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-teal-500 rounded-3xl p-8 md:p-12 text-white text-center">
          <h3 className="mb-3" style={{ fontWeight: 800, fontSize: "1.6rem" }}>
            Ready to take control of your health?
          </h3>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Join thousands of users who caught their condition early and changed their lives.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-md">
              Register — It's Free
            </button>
            
          </div>
        </div>
      </div>
    </section>
  );
}