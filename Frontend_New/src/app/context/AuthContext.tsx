import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "patient" | "doctor";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  dob?: string;
}

interface StoredUser extends AuthUser {
  password: string;
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

const USERS_KEY = "diacheck_users";
const SESSION_KEY = "diacheck_session";

function getStoredUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUser(user: StoredUser) {
  const users = getStoredUsers();
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function saveSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Demo accounts always available
const DEMO_ACCOUNTS: StoredUser[] = [
  {
    id: "demo-patient-1",
    name: "Alex Johnson",
    email: "patient@demo.com",
    password: "demo123",
    role: "patient",
    dob: "1990-05-15",
  },
  {
    id: "demo-doctor-1",
    name: "Dr. Sarah Chen",
    email: "doctor@demo.com",
    password: "demo123",
    role: "doctor",
    dob: "1982-11-03",
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) setUser(session);
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    await new Promise((r) => setTimeout(r, 900)); // Simulate network

    const allUsers = [...DEMO_ACCOUNTS, ...getStoredUsers()];
    const found = allUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!found) {
      return { success: false, error: "Invalid email or password. Try patient@demo.com / demo123" };
    }

    const authUser: AuthUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      dob: found.dob,
    };

    saveSession(authUser);
    setUser(authUser);
    return { success: true, role: found.role };
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    dob: string;
    role: UserRole;
  }): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    await new Promise((r) => setTimeout(r, 900)); // Simulate network

    const allUsers = [...DEMO_ACCOUNTS, ...getStoredUsers()];
    const exists = allUsers.find((u) => u.email.toLowerCase() === data.email.toLowerCase());

    if (exists) {
      return { success: false, error: "An account with this email already exists." };
    }

    const newUser: StoredUser = {
      id: `user-${Date.now()}`,
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      dob: data.dob,
    };

    saveUser(newUser);

    const authUser: AuthUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      dob: newUser.dob,
    };

    saveSession(authUser);
    setUser(authUser);
    return { success: true, role: newUser.role };
  };

  const signOut = () => {
    clearSession();
    setUser(null);
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
