import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi } from "../../api/authApi";

export type UserRole = "patient" | "doctor";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  dob?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    dob: string;
    role: UserRole;
    doctorAccessKey?: string;
  }) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const userData = await authApi.me();
          const role = (userData.role as UserRole) || (localStorage.getItem("role") as UserRole) || "patient";
          localStorage.setItem("role", role);
          setUser({
            id: userData.id,
            name: userData.full_name || userData.email,
            email: userData.email,
            role: role,
          });
        } catch (e) {
          localStorage.clear();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    try {
      const res = await authApi.login({ email, password });
      
      // Store tokens
      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("refresh_token", res.refresh_token);
      
      // Role is nested inside res.user, not at top level
      const role = (res.user?.role as UserRole) || "patient";
      localStorage.setItem("role", role);
      
      setUser({
        id: res.user.id,
        name: res.user.full_name || res.user.email,
        email: res.user.email,
        role: role,
      });
      
      return { success: true, role };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.detail || "Invalid email or password" };
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    dob: string;
    role: UserRole;
    doctorAccessKey?: string;
  }): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    try {
      if (data.role === "doctor") {
        await authApi.registerDoctor({ 
          email: data.email, 
          password: data.password, 
          full_name: data.name,
          doctor_access_key: data.doctorAccessKey || ""
        });
      } else {
        await authApi.registerPatient({ 
          email: data.email, 
          password: data.password, 
          full_name: data.name, 
          dob: data.dob 
        });
      }
      return { success: true, role: data.role };
    } catch (e: any) {
      let errorMsg = "Registration failed. Please try again.";
      const detail = e.response?.data?.detail;
      if (typeof detail === "string") {
        errorMsg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors come as array of { msg, loc, type }
        errorMsg = detail[0].msg || JSON.stringify(detail[0]);
      } else if (e.response?.data?.message) {
        errorMsg = e.response.data.message;
      }
      return { success: false, error: errorMsg };
    }
  };

  const signOut = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
