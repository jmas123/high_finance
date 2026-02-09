import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchWithTimeout } from "../../lib/api";

type PageState = "form" | "loading" | "success" | "error";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pageState, setPageState] = useState<PageState>(token ? "form" : "error");
  const [errorMsg, setErrorMsg] = useState(
    token ? "" : "Missing reset token. Please use the link from your email."
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setPageState("loading");

    try {
      const res = await fetchWithTimeout("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Something went wrong" }));
        throw new Error(body.detail || `Error ${res.status}`);
      }

      setPageState("success");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
      setPageState("error");
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "80px auto",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 12,
          padding: 32,
        }}
      >
        {/* ── Success state ──────────────────────────────────── */}
        {pageState === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#x2705;</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: "#fff" }}>
              Password Updated
            </div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 24, lineHeight: 1.5 }}>
              Your password has been reset successfully. You can now sign in with your new password.
            </div>
            <Link
              to="/dashboard"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Go to Home
            </Link>
          </div>
        )}

        {/* ── Error state (no token or failed reset) ─────────── */}
        {pageState === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#x26A0;&#xFE0F;</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: "#fff" }}>
              Reset Failed
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#ef4444",
                marginBottom: 24,
                lineHeight: 1.5,
                padding: 12,
                background: "#3b1818",
                border: "1px solid #ef4444",
                borderRadius: 6,
              }}
            >
              {errorMsg}
            </div>
            <Link
              to="/dashboard"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                background: "#222",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Go to Home
            </Link>
          </div>
        )}

        {/* ── Form state ─────────────────────────────────────── */}
        {(pageState === "form" || pageState === "loading") && (
          <>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "#fff" }}>
              Set New Password
            </div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
              Enter your new password below.
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
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                  placeholder="At least 8 characters"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#888",
                    marginBottom: 6,
                  }}
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                  placeholder="Type your password again"
                />
              </div>

              {errorMsg && (
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
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={pageState === "loading"}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: pageState === "loading" ? "#444" : "#3b82f6",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: pageState === "loading" ? "not-allowed" : "pointer",
                }}
              >
                {pageState === "loading" ? "Updating..." : "Reset Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
