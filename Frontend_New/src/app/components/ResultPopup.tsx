import { CheckCircle, AlertTriangle, X, ArrowRight, Heart } from "lucide-react";

interface ResultPopupProps {
  isAtRisk: boolean;
  onClose: () => void;
  onNavigateToAuth?: () => void;
}

export function ResultPopup({ isAtRisk, onClose, onNavigateToAuth }: ResultPopupProps) {
  if (!isAtRisk) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Popup */}
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Green top stripe */}
          <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-400" />

          <div className="px-8 py-8">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-teal-400 rounded-full flex items-center justify-center shadow-md">
                  <Heart className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="text-center mb-7">
              <h2
                className="text-slate-900 mb-3"
                style={{ fontWeight: 800, fontSize: "1.35rem" }}
              >
                Great News! 🎉
              </h2>
              <p className="text-emerald-600 font-semibold mb-2 text-base">
                No diabetes risk detected.
              </p>
              <p className="text-slate-500 text-sm leading-relaxed">
                Based on your responses, you currently show low risk indicators for diabetes. 
                Keep up the healthy habits! Regular check-ups and an active lifestyle are 
                your best allies for long-term wellness.
              </p>
            </div>

            {/* Health tips */}
            <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-sm">
              <p className="text-emerald-700 font-semibold mb-2 text-xs uppercase tracking-wide">
                Tips to Stay Healthy
              </p>
              <ul className="space-y-1.5 text-emerald-800">
                {[
                  "Exercise for 30 minutes most days",
                  "Maintain a balanced, low-sugar diet",
                  "Get annual blood glucose checks",
                  "Stay hydrated and manage stress",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-emerald-200"
              >
                Explore the App
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 text-slate-500 hover:text-slate-700 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Amber top stripe */}
        <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-400" />

        <div className="px-8 py-8">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-7">
            <h2
              className="text-slate-900 mb-3"
              style={{ fontWeight: 800, fontSize: "1.35rem" }}
            >
              You May Be at Risk
            </h2>
            <p className="text-amber-600 font-semibold mb-2 text-base">
              Elevated diabetes risk indicators found.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              Based on your responses, some of your health indicators suggest a potential 
              elevated risk of diabetes. Don't worry — early detection is the first step. 
              Sign in to start tracking your health and receive personalized guidance.
            </p>
          </div>

          {/* Warning box */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
            <p className="text-amber-700 font-semibold mb-1.5 text-xs uppercase tracking-wide">
              Recommended Next Steps
            </p>
            <ul className="space-y-1.5 text-amber-800 text-sm">
              {[
                "Consult with your healthcare provider",
                "Start monitoring your blood glucose levels",
                "Review your diet and activity habits",
                "Track your progress with DiaCheck",
              ].map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onNavigateToAuth ?? onClose}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2"
            >
              Sign In to Start Monitoring
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateToAuth ?? onClose}
              className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              Register for Free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm transition-colors"
            >
              Close — I'll do this later
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-xs text-slate-400 mt-4">
            ⚕️ This result is not a clinical diagnosis. Please consult a physician.
          </p>
        </div>
      </div>
    </div>
  );
}