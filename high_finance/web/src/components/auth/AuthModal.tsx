import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { fetchWithTimeout } from "../../lib/api";

type Tab = "login" | "register" | "forgot" | "forgot-sent";

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
        setEmail("");
        setPassword("");
        onClose();
      } else if (tab === "register") {
        await register(email, password);
        setEmail("");
        setPassword("");
        onClose();
      } else if (tab === "forgot") {
        const res = await fetchWithTimeout("/api/v1/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ detail: "Something went wrong" }));
          throw new Error(body.detail || body.message || `Error ${res.status}`);
        }
        setTab("forgot-sent");
      }
    } catch (err: any) {
      setError(err?.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setError(null);
    setPassword("");
  };

  // "Forgot sent" confirmation view
  if (tab === "forgot-sent") {
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
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "#fff" }}>
              Check Your Email
            </div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 24, lineHeight: 1.5 }}>
              If an account with <strong style={{ color: "#ccc" }}>{email}</strong> exists,
              we've sent a password reset link. It expires in 30 minutes.
            </div>
            <button
              type="button"
              onClick={() => switchTab("login")}
              style={{
                padding: "10px 20px",
                background: "#3b82f6",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back to Sign In
            </button>
          </div>
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
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {tab === "forgot" ? (
          /* ── Forgot Password form ──────────────────────────────── */
          <>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#fff" }}>
              Forgot Password
            </div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
              Enter your email and we'll send a reset link.
            </div>

            <form onSubmit={handleSubmit}>
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
                  autoComplete="email"
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
                  marginBottom: 12,
                }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => switchTab("login")}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "transparent",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#888",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Back to Sign In
              </button>
            </form>
          </>
        ) : (
          /* ── Login / Register form ─────────────────────────────── */
          <>
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
                  autoComplete="email"
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
              <div style={{ marginBottom: tab === "login" ? 8 : 20 }}>
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
                  minLength={8}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
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
                  placeholder={tab === "register" ? "At least 8 characters" : "Your password"}
                />
              </div>

              {/* Forgot password link (login tab only) */}
              {tab === "login" && (
                <div style={{ marginBottom: 20, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => switchTab("forgot")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3b82f6",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

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
          </>
        )}

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
