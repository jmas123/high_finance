import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

const TOKEN_KEY = "hf_access_token";
const BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load and validate token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      // Validate token by fetching /me
      fetch(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Invalid token");
        })
        .then((userData: AuthUser) => {
          setToken(storedToken);
          setUser(userData);
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem(TOKEN_KEY);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      const detail = err.detail;
      let message = "Login failed";
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail[0].msg?.replace(/^Value error, /i, "") || message;
      }
      throw new Error(message);
    }

    const data: TokenResponse = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      // FastAPI validation errors return detail as an array of objects
      const detail = err.detail;
      let message = "Registration failed";
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail[0].msg?.replace(/^Value error, /i, "") || message;
      }
      throw new Error(message);
    }

    const data: TokenResponse = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Listen for session-expired events from the API client (401 responses)
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener("hf:session-expired", handler);
    return () => window.removeEventListener("hf:session-expired", handler);
  }, []);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      sessionExpired,
      login,
      register,
      logout,
      clearSessionExpired,
    }),
    [user, token, isLoading, sessionExpired, login, register, logout, clearSessionExpired]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
