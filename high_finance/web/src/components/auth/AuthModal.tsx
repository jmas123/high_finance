import { useState } from "react";
import { useAuth } from "../../lib/auth";

type Tab = "login" | "register";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      // Success - close modal
      setEmail("");
      setPassword("");
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setError(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 12,
          padding: 24,
          width: 360,
          maxWidth: "90vw",
          border: "1px solid #333",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 20,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #333",
          }}
        >
          <button
            type="button"
            onClick={() => switchTab("login")}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: tab === "login" ? "#333" : "transparent",
              border: "none",
              color: tab === "login" ? "#fff" : "#888",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchTab("register")}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: tab === "register" ? "#333" : "transparent",
              border: "none",
              color: tab === "register" ? "#fff" : "#888",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#888",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#222",
                border: "1px solid #444",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#888",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#222",
                border: "1px solid #444",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder={tab === "register" ? "At least 6 characters" : "Your password"}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: 10,
                background: "#3b1818",
                border: "1px solid #ef4444",
                borderRadius: 6,
                color: "#ef4444",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: loading ? "#444" : "#3b82f6",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? "Please wait..."
              : tab === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "none",
            border: "none",
            color: "#666",
            fontSize: 20,
            cursor: "pointer",
            padding: 4,
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}
