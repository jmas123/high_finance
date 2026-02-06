import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import type { PrivateCompanySummary } from "../../lib/types";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  private: { bg: "#3b82f620", text: "#3b82f6", label: "Private" },
  pre_ipo: { bg: "#f59e0b20", text: "#f59e0b", label: "Pre-IPO" },
  filed_s1: { bg: "#22c55e20", text: "#22c55e", label: "Filed S-1" },
};

function formatValuation(val: number | null): string {
  if (val == null) return "Undisclosed";
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

export function PrivateCompanyList() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<PrivateCompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

  useEffect(() => {
    api.privateCompanies()
      .then(setCompanies)
      .catch((e) => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  // Unique sectors for filter buttons
  const sectors = useMemo(() => {
    const s = new Set(companies.map((c) => c.sector).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [companies]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = companies;
    if (sectorFilter) list = list.filter((c) => c.sector === sectorFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [companies, search, sectorFilter]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>&#x23F3;</div>
        Loading private companies...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, background: "#3b1818", border: "1px solid #7f1d1d", borderRadius: 8 }}>
        <b>Error:</b> {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Private Companies
        </h2>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
          Track which public stocks have exposure to pre-IPO companies
        </p>
      </div>

      {/* Search + Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 8,
            color: "#fff",
            padding: "8px 12px",
            fontSize: 13,
            width: 220,
            outline: "none",
          }}
        />
        {sectors.map((s) => (
          <button
            key={s}
            onClick={() => setSectorFilter(sectorFilter === s ? null : s)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${sectorFilter === s ? "#3b82f6" : "#444"}`,
              background: sectorFilter === s ? "#3b82f620" : "#1a1a1a",
              color: sectorFilter === s ? "#3b82f6" : "#aaa",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          No companies match your filters
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((c) => {
            const statusInfo = STATUS_COLORS[c.status] ?? STATUS_COLORS.private;
            return (
              <div
                key={c.slug}
                onClick={() => navigate(`/private/${c.slug}`)}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 16,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#555")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{c.name}</div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      background: statusInfo.bg,
                      color: statusInfo.text,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Sector */}
                {c.sector && (
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>{c.sector}</div>
                )}

                {/* Stats row */}
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase" }}>Valuation</div>
                    <div style={{ fontWeight: 600, fontFamily: "monospace" }}>
                      {formatValuation(c.latest_valuation)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase" }}>Investors</div>
                    <div style={{ fontWeight: 600 }}>{c.investor_count}</div>
                  </div>
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase" }}>Public</div>
                    <div style={{ fontWeight: 600, color: c.public_investor_count > 0 ? "#3b82f6" : "#666" }}>
                      {c.public_investor_count}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
