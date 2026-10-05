import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type Role = "admin" | "guard" | null;

interface AuthState {
  role: Role;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("smartgate-auth");
    if (saved) {
      try {
        setRole(JSON.parse(saved).role);
      } catch {
        setRole(null);
      }
    }
    setLoaded(true);
  }, []);

  const login = (r: Role) => {
    setRole(r);
    localStorage.setItem("smartgate-auth", JSON.stringify({ role: r }));
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem("smartgate-auth");
  };

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
