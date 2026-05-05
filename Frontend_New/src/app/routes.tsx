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
import PatientSettingsPage from "./pages/PatientSettingsPage";
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
    ]
  },
  { path: "*", Component: () => <Navigate to="/" replace /> },
]);