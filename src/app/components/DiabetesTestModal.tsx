import { useState } from "react";
import { X, ChevronRight, ChevronLeft, Activity, User, Scale, Droplets, Users, Dumbbell } from "lucide-react";

interface DiabetesTestModalProps {
  onClose: () => void;
  onResult: (isAtRisk: boolean) => void;
}

interface FormData {
  age: string;
  bmi: string;
  fastingGlucose: string;
  familyHistory: string;
  activityLevel: string;
}

const steps = [
  {
    id: 1,
    icon: User,
    question: "How old are you?",
    description: "Age is a key factor in diabetes risk assessment.",
    field: "age" as keyof FormData,
    type: "number",
    placeholder: "e.g. 35",
    unit: "years",
    hint: "Risk increases significantly after age 45",
  },
  {
    id: 2,
    icon: Scale,
    question: "What is your BMI?",
    description: "Body Mass Index helps assess weight-related health risks.",
    field: "bmi" as keyof FormData,
    type: "number",
    placeholder: "e.g. 24.5",
    unit: "kg/m²",
    hint: "Normal BMI is 18.5–24.9. Overweight ≥25, Obese ≥30",
  },
  {
    id: 3,
    icon: Droplets,
    question: "What is your fasting glucose level?",
    description: "Measured after at least 8 hours without eating.",
    field: "fastingGlucose" as keyof FormData,
    type: "number",
    placeholder: "e.g. 95",
    unit: "mg/dL",
    hint: "Normal: <100 mg/dL. Prediabetes: 100–125. Diabetes: ≥126",
  },
  {
    id: 4,
    icon: Users,
    question: "Do you have a family history of diabetes?",
    description: "Having a first-degree relative with diabetes increases your risk.",
    field: "familyHistory" as keyof FormData,
    type: "select",
    options: [
      { value: "no", label: "No family history" },
      { value: "yes", label: "Yes, parent or sibling has/had diabetes" },
    ],
  },
  {
    id: 5,
    icon: Dumbbell,
    question: "How would you describe your physical activity?",
    description: "Regular exercise significantly reduces diabetes risk.",
    field: "activityLevel" as keyof FormData,
    type: "select",
    options: [
      { value: "active", label: "Active — I exercise 3+ times/week" },
      { value: "moderate", label: "Moderate — I exercise 1–2 times/week" },
      { value: "sedentary", label: "Sedentary — I rarely exercise" },
    ],
  },
];

function calculateRisk(data: FormData): boolean {
  let score = 0;
  const age = parseInt(data.age);
  const bmi = parseFloat(data.bmi);
  const glucose = parseInt(data.fastingGlucose);

  if (age >= 45) score += 2;
  else if (age >= 35) score += 1;

  if (bmi >= 30) score += 2;
  else if (bmi >= 25) score += 1;

  if (glucose >= 126) score += 3;
  else if (glucose >= 100) score += 2;

  if (data.familyHistory === "yes") score += 2;
  if (data.activityLevel === "sedentary") score += 1;

  return score >= 4;
}

export function DiabetesTestModal({ onClose, onResult }: DiabetesTestModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    age: "",
    bmi: "",
    fastingGlucose: "",
    familyHistory: "",
    activityLevel: "",
  });

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const currentValue = formData[step.field];
  const isValid =
    step.type === "select"
      ? currentValue !== ""
      : currentValue !== "" && !isNaN(Number(currentValue)) && Number(currentValue) > 0;

  const handleNext = () => {
    if (!isValid) return;
    if (isLastStep) {
      const atRisk = calculateRisk(formData);
      onResult(atRisk);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) handleNext();
  };

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 pt-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-white/80">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Diabetes Risk Screening</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-white/70 text-xs">
              <span>Question {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 justify-center -mt-2 mb-0 relative z-10">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-6 bg-blue-600"
                  : i < currentStep
                  ? "w-1.5 bg-blue-400"
                  : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pt-6 pb-8">
          {/* Step icon & question */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-blue-600" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-slate-900 mb-1" style={{ fontWeight: 700, fontSize: "1.15rem" }}>
                {step.question}
              </h2>
              <p className="text-slate-500 text-sm">{step.description}</p>
            </div>
          </div>

          {/* Input */}
          {step.type === "number" && (
            <div className="mb-4">
              <div className="relative">
                <input
                  type="number"
                  value={currentValue}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, [step.field]: e.target.value }))
                  }
                  onKeyDown={handleKeyDown}
                  placeholder={step.placeholder}
                  autoFocus
                  className="w-full px-4 py-3.5 pr-20 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-base"
                  style={{ fontWeight: 500 }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                  {step.unit}
                </span>
              </div>
              {step.hint && (
                <p className="mt-2 text-xs text-slate-400 flex items-start gap-1">
                  <span className="text-blue-400 mt-0.5">ⓘ</span>
                  {step.hint}
                </p>
              )}
            </div>
          )}

          {step.type === "select" && (
            <div className="space-y-2.5 mb-4">
              {step.options?.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setFormData((d) => ({ ...d, [step.field]: opt.value }))
                  }
                  className={`w-full px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-150 text-sm ${
                    currentValue === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: currentValue === opt.value ? 600 : 400 }}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt.label}</span>
                    {currentValue === opt.value && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-6">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!isValid}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                isValid
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:shadow-blue-300"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isLastStep ? "Get My Results" : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-xs text-slate-400 mt-4">
            This screening is for informational purposes only and is not a medical diagnosis.
          </p>
        </div>
      </div>
    </div>
  );
}
