import { useNavigate } from "react-router-dom";
import { useIsMobile, useIsLargeScreen } from "../lib/useIsMobile";

interface LandingPageProps {
  onOpenAuth: () => void;
}

const FEATURES = [
  {
    emoji: "🏢",
    title: "Company Research",
    desc: "Fundamentals, financials, leadership, and institutional ownership for any US public company.",
  },
  {
    emoji: "📊",
    title: "DCF Valuation",
    desc: "Interactive discounted cash flow model with sliders for growth, margin, WACC, and terminal value.",
  },
  {
    emoji: "🎲",
    title: "Risk Analysis",
    desc: "Monte Carlo simulation, fan charts, stress scenarios, and distribution analysis for any ticker.",
  },
  {
    emoji: "🏛️",
    title: "Congressional Trading",
    desc: "See what Congress is trading. STOCK Act disclosures with performance backtests and leaderboards.",
  },
  {
    emoji: "🔍",
    title: "Stock Screener",
    desc: "Filter the market by valuation, growth, profitability, and quality metrics. Find ideas fast.",
  },
  {
    emoji: "📈",
    title: "Options Analysis",
    desc: "Options flow, implied volatility context, and a visual decay simulator for any optionable stock.",
  },
  {
    emoji: "🤖",
    title: "ML Predictions",
    desc: "Machine learning models score each stock on 30-day directional probability with feature breakdowns.",
  },
  {
    emoji: "📁",
    title: "Research Projects",
    desc: "Save tickers, snapshots, and notes into organized research projects. Pick up where you left off.",
  },
  {
    emoji: "🏗️",
    title: "Private Companies",
    desc: "Profiles and analysis for pre-IPO and private companies you can't find on Bloomberg.",
  },
  {
    emoji: "✨",
    title: "AI Insights",
    desc: "Generate investment memos, earnings analysis, and AI-powered commentary with one click.",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Search any ticker",
    desc: "No sign-up required. Type a symbol and hit enter.",
  },
  {
    num: "2",
    title: "Explore the data",
    desc: "Fundamentals, DCF, risk, options, and more load automatically.",
  },
  {
    num: "3",
    title: "Build your thesis",
    desc: "Create an account to save projects, track portfolios, and generate AI memos.",
  },
];

export function LandingPage({ onOpenAuth }: LandingPageProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isLargeScreen = useIsLargeScreen();

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      background: "#111",
      color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: isMobile ? "48px 18px 40px" : "80px 24px 60px",
        textAlign: "center",
      }}>
        <h1 style={{
          fontSize: isMobile ? 32 : 48,
          fontWeight: 800,
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: -1,
        }}>
          High Finance
        </h1>
        <p style={{
          fontSize: isMobile ? 17 : 20,
          color: "#ccc",
          marginTop: 16,
          marginBottom: 8,
          fontWeight: 500,
        }}>
          AI-powered equity research for everyone
        </p>
        <p style={{
          fontSize: 15,
          color: "#888",
          maxWidth: 600,
          margin: "0 auto 32px",
          lineHeight: 1.6,
        }}>
          Fundamentals, DCF valuation, risk simulation, congressional trades, and ML predictions
          — all in one place.
        </p>
        <div style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "14px 32px",
              background: "#3b82f6",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try It Free
          </button>
          <button
            onClick={onOpenAuth}
            style={{
              padding: "14px 32px",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 10,
              color: "#fff",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Create Account
          </button>
        </div>
      </section>

      {/* ── Feature Grid ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: isLargeScreen ? 1300 : 1100,
        margin: "0 auto",
        padding: "0 24px 60px",
      }}>
        <h2 style={{
          fontSize: isMobile ? 22 : 28,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 32,
        }}>
          Everything you need to research a stock
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "0 24px 60px",
      }}>
        <h2 style={{
          fontSize: isMobile ? 22 : 28,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 32,
        }}>
          How it works
        </h2>
        <div style={{
          display: "flex",
          gap: 24,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {STEPS.map((s) => (
            <div
              key={s.num}
              style={{
                flex: "1 1 220px",
                maxWidth: 280,
                textAlign: "center",
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#3b82f6",
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                {s.num}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Credibility ─────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "0 24px 60px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.7 }}>
          Data sourced from SEC EDGAR, Yahoo Finance, and public filings.
        </p>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "0 24px 60px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 20,
        }}>
          Ready to start researching?
        </h2>
        <div style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "14px 32px",
              background: "#3b82f6",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try It Free
          </button>
          <button
            onClick={onOpenAuth}
            style={{
              padding: "14px 32px",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 10,
              color: "#fff",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Create Account
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{
        padding: "24px 24px 32px",
        textAlign: "center",
        fontSize: 13,
        color: "#555",
      }}>
        High Finance — 2026
      </footer>
    </div>
  );
}
