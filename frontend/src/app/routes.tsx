import { createBrowserRouter, Navigate } from "react-router";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import DiabetesTestPage from "./pages/DiabetesTestPage";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import GlucoseLogsPage from "./pages/GlucoseLogsPage";
import MealLogsPage from "./pages/MealLogsPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import DoctorAIAssistantPage from "./pages/DoctorAIAssistantPage";
import PatientSettingsPage from "./pages/PatientSettingsPage";
import RetinopathyPage from "./pages/RetinopathyPage";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", Component: LandingPage },
  { path: "/auth", Component: AuthPage },
  { path: "/diabetes-test", Component: DiabetesTestPage },
  {
    path: "/dashboard/patient",
    element: <ProtectedRoute allowedRole="patient" />,
    children: [
      { index: true, Component: PatientDashboard },
      { path: "glucose", Component: GlucoseLogsPage },
      { path: "meals", Component: MealLogsPage },
      { path: "retinopathy", Component: RetinopathyPage },
      { path: "ai-chat", Component: AIAssistantPage },
      { path: "settings", Component: PatientSettingsPage },
    ]
  },
  {
    path: "/dashboard/doctor",
    element: <ProtectedRoute allowedRole="doctor" />,
    children: [
      { index: true, Component: DoctorDashboard },
      { path: "patients", Component: PatientDetailsPage },
      { path: "ai-chat", Component: DoctorAIAssistantPage },
    ]
  },
  { path: "*", Component: () => <Navigate to="/" replace /> },
]);