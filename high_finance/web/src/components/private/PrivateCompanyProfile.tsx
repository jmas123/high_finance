import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { PrivateCompanyProfile as ProfileType, PrivateCompanyInvestor } from "../../lib/types";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  private: { bg: "#3b82f620", text: "#3b82f6", label: "Private" },
  pre_ipo: { bg: "#f59e0b20", text: "#f59e0b", label: "Pre-IPO" },
  filed_s1: { bg: "#22c55e20", text: "#22c55e", label: "Filed S-1" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  corporate: { bg: "#3b82f620", text: "#3b82f6" },
  vc: { bg: "#a855f720", text: "#a855f7" },
  pe: { bg: "#f59e0b20", text: "#f59e0b" },
  sovereign: { bg: "#22c55e20", text: "#22c55e" },
  individual: { bg: "#ef444420", text: "#ef4444" },
};

function formatValuation(val: number | null): string {
  if (val == null) return "Undisclosed";
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function formatAmount(val: number | null): string {
  if (val == null) return "—";
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function InvestorTable({
  title,
  investors,
  showTicker,
}: {
  title: string;
  investors: PrivateCompanyInvestor[];
  showTicker: boolean;
}) {
  const navigate = useNavigate();

  if (investors.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#ccc" }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={thStyle}>Investor</th>
              {showTicker && <th style={thStyle}>Ticker</th>}
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Round / Context</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {investors.map((inv) => {
              const typeColor = TYPE_COLORS[inv.investor_type] ?? TYPE_COLORS.corporate;
              return (
                <tr key={inv.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={tdStyle}>
                    {showTicker && inv.public_ticker ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/quote/${inv.public_ticker}`);
                        }}
                        style={{ color: "#3b82f6", cursor: "pointer", fontWeight: 500 }}
                      >
                        {inv.investor_name}
                      </span>
                    ) : (
                      inv.investor_name
                    )}
                  </td>
                  {showTicker && (
                    <td style={tdStyle}>
                      {inv.public_ticker ? (
                        <Link
                          to={`/quote/${inv.public_ticker}`}
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#3b82f615",
                            color: "#3b82f6",
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "monospace",
                            textDecoration: "none",
                          }}
                        >
                          {inv.public_ticker}
                        </Link>
                      ) : (
                        <span style={{ color: "#555" }}>—</span>
                      )}
                    </td>
                  )}
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        background: typeColor.bg,
                        color: typeColor.text,
                        textTransform: "uppercase",
                      }}
                    >
                      {inv.investor_type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "#aaa" }}>{inv.round_or_context ?? "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>
                    {formatAmount(inv.investment_amount)}
                  </td>
                  <td style={{ ...tdStyle, color: "#888" }}>{inv.investment_date ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 8px",
  fontWeight: 500,
  fontSize: 10,
  textTransform: "uppercase",
  color: "#888",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  whiteSpace: "nowrap",
};

export function PrivateCompanyProfileView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.privateCompany(slug)
      .then(setProfile)
      .catch((e) => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>&#x23F3;</div>
        Loading...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div>
        <button
          onClick={() => navigate("/private")}
          style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 13, marginBottom: 16 }}
        >
          &larr; Back to Private Companies
        </button>
        <div style={{ padding: 20, background: "#3b1818", border: "1px solid #7f1d1d", borderRadius: 8 }}>
          <b>Error:</b> {error ?? "Not found"}
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_COLORS[profile.status] ?? STATUS_COLORS.private;
  const publicInvestors = profile.investors.filter((i) => i.public_ticker);
  const otherInvestors = profile.investors.filter((i) => !i.public_ticker);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate("/private")}
        style={{
          background: "#222",
          border: "1px solid #444",
          borderRadius: 8,
          color: "#888",
          fontSize: 13,
          padding: "6px 14px",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        &larr; All Private Companies
      </button>

      {/* Company header card */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 10,
          padding: 20,
          marginBottom: 16,
        }}
      >
        {/* Name + Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{profile.name}</h1>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: statusInfo.bg,
              color: statusInfo.text,
            }}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Description */}
        {profile.description && (
          <p style={{ fontSize: 14, color: "#aaa", margin: "0 0 16px 0", lineHeight: 1.5 }}>
            {profile.description}
          </p>
        )}

        {/* Info grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
          }}
        >
          {profile.sector && (
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Sector</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.sector}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Valuation</div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>
              {formatValuation(profile.latest_valuation)}
            </div>
            {profile.valuation_date && (
              <div style={{ fontSize: 10, color: "#666" }}>as of {profile.valuation_date}</div>
            )}
          </div>
          {profile.founded_year && (
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Founded</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.founded_year}</div>
            </div>
          )}
          {profile.hq_location && (
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>HQ</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.hq_location}</div>
            </div>
          )}
          {profile.website && (
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}>Website</div>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none" }}
              >
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Investors */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>
          Investors ({profile.investors.length})
          {publicInvestors.length > 0 && (
            <span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 400, marginLeft: 8 }}>
              {publicInvestors.length} publicly traded
            </span>
          )}
        </h2>

        {profile.investors.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#666" }}>
            No investors recorded yet
          </div>
        ) : (
          <>
            <InvestorTable
              title="Public Investors (IPO Exposure)"
              investors={publicInvestors}
              showTicker={true}
            />
            <InvestorTable
              title="Other Investors"
              investors={otherInvestors}
              showTicker={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
