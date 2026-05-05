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
          setUser({
            id: userData.id,
            name: userData.full_name || userData.email,
            email: userData.email,
            role: (localStorage.getItem("role") as UserRole) || "patient",
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
      
      // Store tokens as requested
      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("refresh_token", res.refresh_token);
      localStorage.setItem("role", res.role);
      
      const userData = await authApi.me();
      const role = res.role as UserRole;
      
      setUser({
        id: userData.id,
        name: userData.full_name || userData.email,
        email: userData.email,
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
  }): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    try {
      if (data.role === "doctor") {
        await authApi.registerDoctor({ 
          email: data.email, 
          password: data.password, 
          full_name: data.name 
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
      return { success: false, error: e.response?.data?.detail || "Registration failed" };
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
