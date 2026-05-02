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

export const router = createBrowserRouter([
  { path: "/",                               Component: LandingPage },
  { path: "/auth",                           Component: AuthPage },
  { path: "/diabetes-test",                  Component: DiabetesTestPage },
  { path: "/dashboard/patient",              Component: PatientDashboard },
  { path: "/dashboard/patient/glucose",      Component: GlucoseLogsPage },
  { path: "/dashboard/patient/meals",        Component: MealLogsPage },
  { path: "/dashboard/patient/ai-chat",      Component: AIAssistantPage },
  { path: "/dashboard/patient/settings",     Component: PatientSettingsPage },
  { path: "/dashboard/doctor",               Component: DoctorDashboard },
  { path: "/dashboard/doctor/patients",      Component: PatientDetailsPage },
  { path: "*", Component: () => <Navigate to="/" replace /> },
]);