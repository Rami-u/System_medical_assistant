import { Navigate, Outlet } from "react-router";
import { useAuth, UserRole } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  allowedRole?: UserRole;
}

export default function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  
  // Checking local storage manually avoids blinking out while auth context loads
  const token = localStorage.getItem("access_token");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!token && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRole && user && user.role !== allowedRole) {
    // Redirect if they have wrong role (e.g. patient trying to see doctor dash)
    return <Navigate to={user.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient"} replace />;
  }

  return <Outlet />;
}
