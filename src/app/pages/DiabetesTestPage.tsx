import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, ArrowRight, ArrowLeft, ChevronRight, ChevronLeft,
  User, Scale, Droplets, Users, Dumbbell, CheckCircle,
  AlertTriangle, Heart, ShieldCheck, Info, Zap, BarChart2,
  Star, Clock, Brain, Flame,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SimpleFormData {
  age: string;
  height: string;
  weight: string;
  fastingGlucose: string;
  familyHistory: string;
  activityLevel: string;
}

interface AdvancedFormData {
  gender: string;
  age: string;
  height: string;
  weight: string;
  hypertension: string;
  heartDisease: string;
  smokingHistory: string;
  hba1c: string;
  bloodGlucose: string;
}

type PageState = "selection" | "simple" | "advanced" | "result-positive" | "result-negative";
type TestType = "simple" | "advanced";

type StepColor =
  | "blue" | "indigo" | "cyan" | "violet" | "teal"
  | "purple" | "rose" | "amber" | "emerald";

interface TestStep {
  id: number;
  icon: React.ElementType;
  color: StepColor;
  question: string;
  description: string;
  field: string;
  type: "number" | "select" | "body-metrics";
  placeholder?: string;
  unit?: string;
  hint?: string;
  options?: { value: string; label: string; detail?: string }[];
}

// ─── Simple Steps Config ──────────────────────────────────────────────────────
const simpleSteps: TestStep[] = [
  {
    id: 1, icon: User, color: "blue",
    question: "How old are you?",
    description: "Age is one of the most significant factors in diabetes risk assessment.",
    field: "age", type: "number", placeholder: "e.g. 35", unit: "years",
    hint: "Risk increases significantly after age 45",
  },
  {
    id: 2, icon: Scale, color: "indigo",
    question: "What are your height and weight?",
    description: "We'll calculate your BMI automatically to assess weight-related health risks.",
    field: "height", type: "body-metrics",
    hint: "BMI is calculated from your height and weight",
  },
  {
    id: 3, icon: Droplets, color: "cyan",
    question: "What is your fasting glucose level?",
    description: "Measured after at least 8 hours without eating.",
    field: "fastingGlucose", type: "number", placeholder: "e.g. 95", unit: "mg/dL",
    hint: "Normal: <100 · Prediabetes: 100–125 · Diabetes: ≥126",
  },
  {
    id: 4, icon: Users, color: "violet",
    question: "Do you have a family history of diabetes?",
    description: "Having a first-degree relative with diabetes increases your risk.",
    field: "familyHistory", type: "select",
    options: [
      { value: "no", label: "No family history", detail: "No parent or sibling with diabetes" },
      { value: "yes", label: "Yes, parent or sibling", detail: "At least one first-degree relative has/had diabetes" },
    ],
  },
  {
    id: 5, icon: Dumbbell, color: "teal",
    question: "How would you describe your physical activity?",
    description: "Regular exercise significantly reduces diabetes risk.",
    field: "activityLevel", type: "select",
    options: [
      { value: "active",    label: "Active",    detail: "I exercise 3+ times per week" },
      { value: "moderate",  label: "Moderate",  detail: "I exercise 1–2 times per week" },
      { value: "sedentary", label: "Sedentary", detail: "I rarely or never exercise" },
    ],
  },
];

// ─── Advanced Steps Config ────────────────────────────────────────────────────
const advancedSteps: TestStep[] = [
  {
    id: 1, icon: Users, color: "purple",
    question: "What is your biological sex?",
    description: "Biological sex influences hormonal and metabolic risk factors for diabetes.",
    field: "gender", type: "select",
    options: [
      { value: "male",   label: "Male",   detail: "Assigned male at birth" },
      { value: "female", label: "Female", detail: "Assigned female at birth" },
    ],
  },
  {
    id: 2, icon: User, color: "indigo",
    question: "How old are you?",
    description: "Age is one of the strongest predictors of type 2 diabetes onset.",
    field: "age", type: "number", placeholder: "e.g. 45", unit: "years",
    hint: "Risk increases significantly after age 45",
  },
  {
    id: 3, icon: Scale, color: "violet",
    question: "What are your height and weight?",
    description: "Body Mass Index (BMI) is a key clinical indicator used in diabetes risk models.",
    field: "height", type: "body-metrics",
    hint: "BMI ≥25 overweight · BMI ≥30 obese (higher risk)",
  },
  {
    id: 4, icon: Activity, color: "rose",
    question: "Have you been diagnosed with hypertension?",
    description: "High blood pressure and type 2 diabetes often co-occur and share risk factors.",
    field: "hypertension", type: "select",
    options: [
      { value: "no",  label: "No", detail: "I do not have high blood pressure" },
      { value: "yes", label: "Yes", detail: "I have been diagnosed with hypertension" },
    ],
  },
  {
    id: 5, icon: Heart, color: "rose",
    question: "Have you been diagnosed with heart disease?",
    description: "Cardiovascular disease and diabetes share many risk factors and often appear together.",
    field: "heartDisease", type: "select",
    options: [
      { value: "no",  label: "No", detail: "No diagnosed heart condition" },
      { value: "yes", label: "Yes", detail: "I have been diagnosed with heart disease" },
    ],
  },
  {
    id: 6, icon: Flame, color: "amber",
    question: "What is your smoking history?",
    description: "Smoking increases insulin resistance and is a significant risk factor for diabetes.",
    field: "smokingHistory", type: "select",
    options: [
      { value: "never",   label: "Never smoked",    detail: "I have never smoked" },
      { value: "former",  label: "Former smoker",   detail: "I used to smoke but have quit" },
      { value: "current", label: "Current smoker",  detail: "I currently smoke" },
      { value: "unknown", label: "Not sure / Prefer not to say", detail: "" },
    ],
  },
  {
    id: 7, icon: BarChart2, color: "teal",
    question: "What is your HbA1c level?",
    description: "HbA1c reflects your average blood sugar over the past 2–3 months — the most reliable diabetes marker.",
    field: "hba1c", type: "number", placeholder: "e.g. 5.4", unit: "%",
    hint: "Normal: <5.7% · Prediabetes: 5.7–6.4% · Diabetes: ≥6.5%",
  },
  {
    id: 8, icon: Droplets, color: "cyan",
    question: "What is your current blood glucose level?",
    description: "Blood glucose level (after fasting or random) is a direct diabetes indicator.",
    field: "bloodGlucose", type: "number", placeholder: "e.g. 100", unit: "mg/dL",
    hint: "Normal: <100 · Prediabetes: 100–125 · Diabetes: ≥126",
  },
];

// ─── Risk Calculators ─────────────────────────────────────────────────────────
function calculateSimpleRisk(data: SimpleFormData) {
  let score = 0;
  const age = parseInt(data.age);
  const heightM = parseFloat(data.height) / 100;
  const bmi = parseFloat(data.weight) / (heightM * heightM);
  const glucose = parseInt(data.fastingGlucose);

  if (age >= 45) score += 2;
  else if (age >= 35) score += 1;
  if (bmi >= 30) score += 2;
  else if (bmi >= 25) score += 1;
  if (glucose >= 126) score += 3;
  else if (glucose >= 100) score += 2;
  if (data.familyHistory === "yes") score += 2;
  if (data.activityLevel === "sedentary") score += 1;

  return { isAtRisk: score >= 4, score, maxScore: 10, riskLevel: score >= 7 ? "High" : score >= 4 ? "Moderate" : "Low" };
}

function calculateAdvancedRisk(data: AdvancedFormData) {
  let score = 0;
  const age = parseInt(data.age);
  const heightM = parseFloat(data.height) / 100;
  const bmi = parseFloat(data.weight) / (heightM * heightM);
  const hba1c = parseFloat(data.hba1c);
  const glucose = parseFloat(data.bloodGlucose);

  // Age
  if (age >= 65) score += 3;
  else if (age >= 45) score += 2;
  else if (age >= 35) score += 1;

  // BMI
  if (bmi >= 35) score += 3;
  else if (bmi >= 30) score += 2;
  else if (bmi >= 25) score += 1;

  // Clinical conditions
  if (data.hypertension === "yes") score += 3;
  if (data.heartDisease === "yes") score += 2;

  // Smoking
  if (data.smokingHistory === "current") score += 2;
  else if (data.smokingHistory === "former") score += 1;

  // HbA1c — most predictive marker
  if (hba1c >= 6.5) score += 6;
  else if (hba1c >= 5.7) score += 3;

  // Blood glucose
  if (glucose >= 200) score += 5;
  else if (glucose >= 126) score += 4;
  else if (glucose >= 100) score += 2;

  const maxScore = 24;
  let riskLevel = "Low";
  if (score >= 14) riskLevel = "High";
  else if (score >= 9) riskLevel = "Moderate";
  else if (score >= 5) riskLevel = "Borderline";

  return {
    isAtRisk: score >= 9,
    score,
    maxScore,
    riskLevel,
  };
}

// ─── Color map ────────────────────────────────────────────────────────────────
const colorMap: Record<StepColor, { bg: string; icon: string; border: string; ring: string; btn: string; progress: string }> = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    border: "border-blue-500",    ring: "ring-blue-100",    btn: "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-200 hover:shadow-blue-300",    progress: "from-blue-600 via-blue-500 to-indigo-600" },
  indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  border: "border-indigo-500",  ring: "ring-indigo-100",  btn: "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-200 hover:shadow-blue-300",    progress: "from-blue-600 via-blue-500 to-indigo-600" },
  cyan:    { bg: "bg-cyan-50",    icon: "text-cyan-600",    border: "border-cyan-500",    ring: "ring-cyan-100",    btn: "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-200 hover:shadow-blue-300",    progress: "from-blue-600 via-blue-500 to-indigo-600" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  border: "border-violet-500",  ring: "ring-violet-100",  btn: "from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-violet-200 hover:shadow-violet-300", progress: "from-violet-600 via-purple-500 to-indigo-600" },
  teal:    { bg: "bg-teal-50",    icon: "text-teal-600",    border: "border-teal-500",    ring: "ring-teal-100",    btn: "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-200 hover:shadow-blue-300",    progress: "from-blue-600 via-blue-500 to-indigo-600" },
  purple:  { bg: "bg-purple-50",  icon: "text-purple-600",  border: "border-purple-500",  ring: "ring-purple-100",  btn: "from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-violet-200 hover:shadow-violet-300", progress: "from-violet-600 via-purple-500 to-indigo-600" },
  rose:    { bg: "bg-rose-50",    icon: "text-rose-600",    border: "border-rose-500",    ring: "ring-rose-100",    btn: "from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-violet-200 hover:shadow-violet-300", progress: "from-violet-600 via-purple-500 to-indigo-600" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   border: "border-amber-500",   ring: "ring-amber-100",   btn: "from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-violet-200 hover:shadow-violet-300", progress: "from-violet-600 via-purple-500 to-indigo-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-500", ring: "ring-emerald-100", btn: "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-200 hover:shadow-blue-300",    progress: "from-blue-600 via-blue-500 to-indigo-600" },
};

const advancedProgressGradient = "from-violet-600 via-purple-500 to-indigo-600";
const simpleProgressGradient   = "from-blue-600 via-blue-500 to-indigo-600";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DiabetesTestPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("selection");
  const [activeTest, setActiveTest] = useState<TestType | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [simpleFormData, setSimpleFormData] = useState<SimpleFormData>({
    age: "", height: "", weight: "", fastingGlucose: "", familyHistory: "", activityLevel: "",
  });
  const [advancedFormData, setAdvancedFormData] = useState<AdvancedFormData>({
    gender: "", age: "", height: "", weight: "", hypertension: "", heartDisease: "",
    smokingHistory: "", hba1c: "", bloodGlucose: "",
  });
  const [riskResult, setRiskResult] = useState<{
    score: number; maxScore: number; riskLevel: string;
  } | null>(null);

  // ── Derived values ──────────────────────────────────────────────────────────
  const activeSteps = activeTest === "advanced" ? advancedSteps : simpleSteps;
  const step = activeSteps[currentStep] ?? activeSteps[0];
  const isLastStep = currentStep === activeSteps.length - 1;
  const progress = ((currentStep + 1) / activeSteps.length) * 100;
  const colors = colorMap[step.color];

  const getFormValue = (field: string): string => {
    if (activeTest === "advanced") return advancedFormData[field as keyof AdvancedFormData] ?? "";
    return simpleFormData[field as keyof SimpleFormData] ?? "";
  };
  const currentValue = getFormValue(step.field);

  const isValid = (() => {
    if (step.type === "body-metrics") {
      const h = getFormValue("height");
      const w = getFormValue("weight");
      return h !== "" && w !== "" && !isNaN(Number(h)) && Number(h) > 0 && !isNaN(Number(w)) && Number(w) > 0;
    }
    if (step.type === "select") return currentValue !== "";
    return currentValue !== "" && !isNaN(Number(currentValue)) && Number(currentValue) > 0;
  })();

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleStartTest = (type: TestType) => {
    setActiveTest(type);
    setCurrentStep(0);
    setPageState(type);
  };

  const updateField = (field: string, value: string) => {
    if (activeTest === "advanced") {
      setAdvancedFormData((d) => ({ ...d, [field]: value }));
    } else {
      setSimpleFormData((d) => ({ ...d, [field]: value }));
    }
  };

  const handleNext = () => {
    if (!isValid) return;
    if (isLastStep) {
      let result;
      if (activeTest === "advanced") {
        result = calculateAdvancedRisk(advancedFormData);
      } else {
        result = calculateSimpleRisk(simpleFormData);
      }
      setRiskResult({ score: result.score, maxScore: result.maxScore, riskLevel: result.riskLevel });
      setPageState(result.isAtRisk ? "result-positive" : "result-negative");
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else {
      setPageState("selection");
      setActiveTest(null);
    }
  };

  const handleRetake = () => {
    setCurrentStep(0);
    setSimpleFormData({ age: "", height: "", weight: "", fastingGlucose: "", familyHistory: "", activityLevel: "" });
    setAdvancedFormData({ gender: "", age: "", height: "", weight: "", hypertension: "", heartDisease: "", smokingHistory: "", hba1c: "", bloodGlucose: "" });
    setRiskResult(null);
    setActiveTest(null);
    setPageState("selection");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) handleNext();
  };

  const Icon = step.icon;
  const riskPercent = riskResult ? Math.round((riskResult.score / riskResult.maxScore) * 100) : 0;
  const progressGradient = activeTest === "advanced" ? advancedProgressGradient : simpleProgressGradient;
  const btnGradient = activeTest === "advanced"
    ? "from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-violet-200 hover:shadow-violet-300"
    : "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-200 hover:shadow-blue-300";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
            Dia<span className="text-blue-600">Check</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
            Sign In
          </Link>
          <Link to="/auth" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-200">
            Create Account
          </Link>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SELECTION SCREEN                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {pageState === "selection" && (
          <div className="w-full max-w-3xl">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                Free · Instant · Confidential
              </div>
              <h1 className="text-slate-900 mb-3" style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", letterSpacing: "-0.02em" }}>
                Diabetes Risk Screening
              </h1>
              <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
                Choose the screening type that suits you best. Both tests are free and give you instant results.
              </p>
            </div>

            {/* Test Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

              {/* ── Simple Test Card ──────────────────────────────────────── */}
              <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-lg shadow-slate-200/50 overflow-hidden hover:border-blue-200 hover:shadow-blue-100/60 transition-all duration-200 flex flex-col">
                {/* Top accent */}
                <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />

                <div className="p-7 flex flex-col flex-1">
                  {/* Badge */}
                  <div className="flex items-center gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                      <Clock className="w-3 h-3" />
                      Quick
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-7 h-7 text-blue-600" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h2 className="text-slate-900" style={{ fontWeight: 700, fontSize: "1.15rem" }}>
                        Simple Screening
                      </h2>
                      <p className="text-slate-400 text-xs mt-0.5">5 questions · ~2 minutes</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-500 text-sm leading-relaxed mb-5">
                    A quick, easy assessment using everyday health information. Perfect for a fast first check.
                  </p>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {["Age", "BMI (Height & Weight)", "Fasting Glucose", "Family History", "Physical Activity"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleStartTest("simple")}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Start Simple Test
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Advanced Test Card ────────────────────────────────────── */}
              <div className="bg-white rounded-3xl border-2 border-violet-100 shadow-lg shadow-violet-100/50 overflow-hidden hover:border-violet-300 hover:shadow-violet-200/60 transition-all duration-200 flex flex-col relative">
                {/* Top accent */}
                <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-600" />

                {/* Most Accurate ribbon */}
                <div className="absolute top-5 right-5">
                  <span className="inline-flex items-center gap-1 bg-violet-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-md shadow-violet-300">
                    <Star className="w-3 h-3 fill-white" />
                    Most Accurate
                  </span>
                </div>

                <div className="p-7 flex flex-col flex-1">
                  {/* Badge */}
                  <div className="flex items-center gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-semibold">
                      <Brain className="w-3 h-3" />
                      Advanced
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                      <Zap className="w-3 h-3" />
                      Clinical Biomarkers
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Brain className="w-7 h-7 text-violet-600" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h2 className="text-slate-900" style={{ fontWeight: 700, fontSize: "1.15rem" }}>
                        Advanced Analysis
                      </h2>
                      <p className="text-slate-400 text-xs mt-0.5">8 questions · ~5 minutes</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-500 text-sm leading-relaxed mb-3">
                    A comprehensive assessment using clinical biomarkers for significantly higher predictive accuracy.
                  </p>

                  {/* Accuracy callout */}
                  <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                    <p className="text-violet-700 text-xs leading-relaxed">
                      <span style={{ fontWeight: 700 }}>More accurate than the simple test.</span> Uses medical biomarkers
                      like HbA1c and blood glucose — the same features used in clinical AI models. Requires more detailed answers.
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {[
                      "Biological Sex & Age",
                      "BMI (Height & Weight)",
                      "Hypertension & Heart Disease",
                      "Smoking History",
                      "HbA1c Level (glycated hemoglobin)",
                      "Blood Glucose Level",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleStartTest("advanced")}
                    className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-violet-200 hover:shadow-violet-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Start Advanced Test
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Back to home */}
            <div className="text-center">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm transition-colors mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TEST FORM (shared for simple & advanced)                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {(pageState === "simple" || pageState === "advanced") && (
          <div className="w-full max-w-2xl">

            {/* Header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4 ${
                activeTest === "advanced" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
              }`}>
                {activeTest === "advanced" ? <Brain className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {activeTest === "advanced" ? "Advanced Analysis · 8 Questions" : "Simple Screening · 5 Questions"}
              </div>
              <h1 className="text-slate-900 mb-3" style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", letterSpacing: "-0.02em" }}>
                Diabetes Risk Screening
              </h1>
              <p className="text-slate-500 text-base max-w-md mx-auto leading-relaxed">
                {activeTest === "advanced"
                  ? "Answer these clinical questions for a highly accurate diabetes risk assessment."
                  : "Answer 5 simple questions to get your personalized diabetes risk assessment."}
              </p>
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">

              {/* Progress Header */}
              <div className={`bg-gradient-to-r ${progressGradient} px-8 pt-7 pb-6`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/80 text-sm font-medium">
                    Question {currentStep + 1} of {activeSteps.length}
                  </span>
                  <span className="text-white/80 text-sm font-medium">
                    {Math.round(progress)}% complete
                  </span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex gap-2 mt-4 justify-center">
                  {activeSteps.map((s, i) => (
                    <div
                      key={s.id}
                      className={`rounded-full transition-all duration-300 ${
                        i === currentStep ? "w-6 h-2 bg-white"
                        : i < currentStep ? "w-2 h-2 bg-white/60"
                        : "w-2 h-2 bg-white/25"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <div className="px-8 py-8">

                {/* Question header */}
                <div className="flex items-start gap-4 mb-7">
                  <div className={`w-14 h-14 ${colors.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-7 h-7 ${colors.icon}`} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h2 className="text-slate-900 mb-1.5" style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                      {step.question}
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>

                {/* Number Input */}
                {step.type === "number" && (
                  <div className="mb-6">
                    <div className="relative">
                      <input
                        type="number"
                        value={currentValue}
                        onChange={(e) => updateField(step.field, e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={step.placeholder}
                        autoFocus
                        className={`w-full px-5 py-4 pr-24 border-2 rounded-2xl text-slate-900 placeholder-slate-300 focus:outline-none transition-all text-lg ${
                          currentValue
                            ? `${colors.border} ring-4 ${colors.ring} focus:${colors.border}`
                            : "border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        }`}
                        style={{ fontWeight: 600 }}
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                        {step.unit}
                      </span>
                    </div>
                    {step.hint && (
                      <div className="flex items-start gap-2 mt-3 text-xs text-slate-400">
                        <Info className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${activeTest === "advanced" ? "text-violet-400" : "text-blue-400"}`} />
                        <span>{step.hint}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body Metrics Input */}
                {step.type === "body-metrics" && (
                  <div className="space-y-3 mb-6">
                    {[
                      { field: "height", placeholder: "Height (cm)", unit: "cm", value: getFormValue("height") },
                      { field: "weight", placeholder: "Weight (kg)", unit: "kg", value: getFormValue("weight") },
                    ].map((input) => (
                      <div key={input.field} className="relative">
                        <input
                          type="number"
                          value={input.value}
                          onChange={(e) => updateField(input.field, e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={input.placeholder}
                          autoFocus={input.field === "height"}
                          className={`w-full px-5 py-4 pr-24 border-2 rounded-2xl text-slate-900 placeholder-slate-300 focus:outline-none transition-all text-lg ${
                            input.value
                              ? `${colors.border} ring-4 ${colors.ring} focus:${colors.border}`
                              : "border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          }`}
                          style={{ fontWeight: 600 }}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                          {input.unit}
                        </span>
                      </div>
                    ))}
                    {/* Live BMI preview */}
                    {(() => {
                      const h = parseFloat(getFormValue("height"));
                      const w = parseFloat(getFormValue("weight"));
                      if (h > 0 && w > 0) {
                        const bmi = w / ((h / 100) ** 2);
                        const label = bmi >= 30 ? "Obese" : bmi >= 25 ? "Overweight" : bmi >= 18.5 ? "Normal" : "Underweight";
                        const color = bmi >= 30 ? "text-red-500" : bmi >= 25 ? "text-amber-500" : "text-emerald-600";
                        return (
                          <div className={`flex items-center gap-2 mt-1 text-xs ${activeTest === "advanced" ? "text-violet-500" : "text-blue-400"}`}>
                            <Info className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>BMI: <span className={`font-bold ${color}`}>{bmi.toFixed(1)}</span> — {label}</span>
                          </div>
                        );
                      }
                      return step.hint ? (
                        <div className={`flex items-start gap-2 mt-1 text-xs text-slate-400`}>
                          <Info className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${activeTest === "advanced" ? "text-violet-400" : "text-blue-400"}`} />
                          <span>{step.hint}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Select Options */}
                {step.type === "select" && (
                  <div className="space-y-3 mb-6">
                    {step.options?.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateField(step.field, opt.value)}
                        className={`w-full px-5 py-4 rounded-2xl border-2 text-left transition-all duration-150 ${
                          currentValue === opt.value
                            ? `${colors.border} ${colors.bg} ring-4 ${colors.ring}`
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={`text-sm ${currentValue === opt.value ? colors.icon : "text-slate-800"}`}
                              style={{ fontWeight: currentValue === opt.value ? 700 : 500 }}
                            >
                              {opt.label}
                            </p>
                            {opt.detail && (
                              <p className="text-slate-400 text-xs mt-0.5">{opt.detail}</p>
                            )}
                          </div>
                          {currentValue === opt.value && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              step.color === "violet" || step.color === "purple" || step.color === "rose" || step.color === "amber"
                                ? "bg-violet-500" : "bg-blue-500"
                            }`}>
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {currentStep === 0 ? "Back" : "Back"}
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!isValid}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      isValid
                        ? `bg-gradient-to-r ${btnGradient} text-white shadow-lg hover:-translate-y-0.5`
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {isLastStep ? "Get My Results" : "Continue"}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-5">
                  ⚕️ This screening is for informational purposes only and is not a medical diagnosis.
                </p>
              </div>
            </div>

            {/* Progress label */}
            <div className="text-center mt-6">
              <p className="text-slate-400 text-sm">
                Step {currentStep + 1} of {activeSteps.length} ·{" "}
                <button onClick={handleRetake} className="underline hover:text-slate-600 transition-colors">
                  Choose a different test
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* RESULT: AT RISK                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {pageState === "result-positive" && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

              <div className="px-8 py-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-12 h-12 text-amber-500" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div className="text-center mb-6">
                  <h2 className="text-slate-900 mb-2" style={{ fontWeight: 800, fontSize: "1.5rem" }}>
                    You May Be at Risk
                  </h2>
                  {riskResult && (
                    <div className="inline-flex items-center gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        riskResult.riskLevel === "High" ? "bg-red-100 text-red-700"
                        : riskResult.riskLevel === "Moderate" ? "bg-amber-100 text-amber-700"
                        : "bg-orange-100 text-orange-700"
                      }`}>
                        {riskResult.riskLevel} Risk
                      </span>
                      {activeTest === "advanced" && (
                        <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <Brain className="w-3 h-3" />
                          Advanced Analysis
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-amber-600 font-semibold mb-3 text-base">
                    Elevated diabetes risk indicators detected.
                  </p>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Based on your responses, some of your health indicators suggest a potentially elevated
                    risk of diabetes. Early detection is the first step toward better health —
                    create a free account to start monitoring and receive personalized guidance.
                  </p>
                </div>

                {/* Risk score bar */}
                {riskResult && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-amber-700 text-xs font-semibold uppercase tracking-wide">Risk Score</span>
                      <span className="text-amber-700 text-sm font-bold">{riskResult.score} / {riskResult.maxScore}</span>
                    </div>
                    <div className="h-3 bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
                        style={{ width: `${riskPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Next steps */}
                <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                  <p className="text-slate-700 text-xs font-semibold uppercase tracking-wide mb-3">Recommended Next Steps</p>
                  <ul className="space-y-2 text-slate-600 text-sm">
                    {[
                      "Create a free DiaCheck account to track your metrics",
                      "Consult with your healthcare provider soon",
                      "Start monitoring your blood glucose levels daily",
                      "Review your diet and physical activity habits",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => navigate("/auth")}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Create a Free Account & Start Monitoring
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate("/auth")}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    Sign In to Existing Account
                  </button>
                  <button
                    onClick={handleRetake}
                    className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm transition-colors"
                  >
                    ↺ Try a Different Test
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-4">
                  ⚕️ This result is not a clinical diagnosis. Please consult a physician.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* RESULT: LOW RISK                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {pageState === "result-negative" && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

              <div className="px-8 py-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-12 h-12 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-teal-400 rounded-full flex items-center justify-center shadow-md">
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div className="text-center mb-6">
                  <h2 className="text-slate-900 mb-2" style={{ fontWeight: 800, fontSize: "1.5rem" }}>
                    Great News! 🎉
                  </h2>
                  {riskResult && (
                    <div className="inline-flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        {riskResult.riskLevel} Risk
                      </span>
                      {activeTest === "advanced" && (
                        <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <Brain className="w-3 h-3" />
                          Advanced Analysis
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-emerald-600 font-semibold mb-3 text-base">
                    Your condition looks good — no diabetes risk detected.
                  </p>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Based on your responses, your health indicators currently show a low risk for diabetes.
                    Keep up the healthy habits! Regular check-ups and an active lifestyle
                    are your best allies for long-term wellness.
                  </p>
                </div>

                {/* Risk score bar */}
                {riskResult && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-emerald-700 text-xs font-semibold uppercase tracking-wide">Risk Score</span>
                      <span className="text-emerald-700 text-sm font-bold">{riskResult.score} / {riskResult.maxScore}</span>
                    </div>
                    <div className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
                        style={{ width: `${riskPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Tips */}
                <div className="bg-emerald-50 rounded-2xl p-4 mb-6">
                  <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wide mb-3">Tips to Stay Healthy</p>
                  <ul className="space-y-2 text-emerald-800 text-sm">
                    {[
                      "Exercise for 30 minutes most days of the week",
                      "Maintain a balanced, low-sugar diet",
                      "Get an annual blood glucose check with your doctor",
                      "Stay hydrated and manage stress levels",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => navigate("/")}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Back to Home
                  </button>
                  <button
                    onClick={() => navigate("/auth")}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    Create an Account to Track Over Time
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleRetake}
                    className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm transition-colors"
                  >
                    ↺ Try a Different Test
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-4">
                  ⚕️ This result is not a clinical diagnosis. Please consult a physician regularly.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
