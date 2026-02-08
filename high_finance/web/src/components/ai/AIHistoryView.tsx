import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import type { AIHistoryItem, AIHistoryDetail, AIHistoryStats } from "../../lib/types";
import { renderMarkdown } from "../common/MarkdownRenderer";
import { useAuth } from "../../lib/auth";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  memo: { label: "Memo", color: "#f59e0b" },
  financial_analysis: { label: "Financial Analysis", color: "#8b5cf6" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { label: type, color: "#888" };
}

function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AIHistoryView() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<AIHistoryItem[]>([]);
  const [stats, setStats] = useState<AIHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<AIHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch list and stats
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      api.aiHistory.list(filter),
      api.aiHistory.stats(),
    ])
      .then(([itemsData, statsData]) => {
        setItems(itemsData);
        setStats(statsData);
      })
      .catch((e) => console.error("Failed to load AI history:", e))
      .finally(() => setLoading(false));
  }, [isAuthenticated, filter]);

  // Fetch detail when expanding
  useEffect(() => {
    if (expandedId == null) {
      setExpandedDetail(null);
      return;
    }
    setDetailLoading(true);
    api.aiHistory
      .detail(expandedId)
      .then(setExpandedDetail)
      .catch((e) => console.error("Failed to load detail:", e))
      .finally(() => setDetailLoading(false));
  }, [expandedId]);

  const renderedContent = useMemo(() => {
    if (!expandedDetail?.content) return null;
    return renderMarkdown(expandedDetail.content);
  }, [expandedDetail]);

  // Auth gate
  if (authLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>&#x23F3;</div>
        <div style={{ fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F512;</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Sign in to view AI History</div>
        <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
          Your AI-generated memos and analyses are saved here.
        </div>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "10px 24px",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const FILTERS: Array<{ key: string | undefined; label: string }> = [
    { key: undefined, label: "All" },
    { key: "memo", label: "Memos" },
    { key: "financial_analysis", label: "Financial Analysis" },
  ];

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>AI History</h2>
          <div style={{ fontSize: 13, color: "#888" }}>
            All your AI-generated analyses in one place
          </div>
        </div>

        {/* Stats card */}
        {stats && (
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 10,
              padding: "12px 16px",
              minWidth: 220,
            }}
          >
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 8 }}>
              Monthly AI Usage
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total_count}</div>
                <div style={{ fontSize: 11, color: "#888" }}>Total Analyses</div>
              </div>
              
            </div>

            {/* Type breakdown */}
            {stats.by_type.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {stats.by_type.map((t) => {
                  const cfg = getTypeConfig(t.analysis_type);
                  return (
                    <div key={t.analysis_type} style={{ fontSize: 11 }}>
                      <span style={{ color: cfg.color }}>{cfg.label}</span>{" "}
                      <span style={{ color: "#888" }}>{t.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(filter === f.key ? undefined : f.key)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              cursor: "pointer",
              background: filter === f.key ? "#3b82f6" : "#2d2d2d",
              color: "#fff",
              border: "none",
              borderRadius: 6,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>&#x1F4AD;</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No analyses yet</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            Generate an AI analysis or memo on any ticker to see it here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => {
            const cfg = getTypeConfig(item.analysis_type);
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: "#1a1a1a",
                  border: `1px solid ${isExpanded ? "#555" : "#333"}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Summary row — always visible */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Ticker */}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/quote/${item.ticker}`);
                    }}
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#3b82f6",
                      cursor: "pointer",
                      minWidth: 60,
                    }}
                  >
                    {item.ticker}
                  </span>

                  {/* Type badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: `${cfg.color}20`,
                      color: cfg.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cfg.label}
                  </span>

                  {/* Preview */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "#888",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.content_preview}
                  </span>

                  {/* Relative time */}
                  <span style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>
                    {relativeTime(item.created_at)}
                  </span>

                  {/* Expand chevron */}
                  <span style={{ fontSize: 12, color: "#666", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                    &#x25BC;
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #333", padding: 16 }}>
                    {detailLoading ? (
                      <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>Loading full content...</div>
                    ) : expandedDetail ? (
                      <div>
                        {/* Meta info */}
                        <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "#888" }}>
                          {expandedDetail.model_used && <span>Model: {expandedDetail.model_used}</span>}
                          {expandedDetail.input_tokens != null && (
                            <span>Tokens: {(expandedDetail.input_tokens + (expandedDetail.output_tokens || 0)).toLocaleString()}</span>
                          )}
                          <span>{new Date(expandedDetail.created_at).toLocaleString()}</span>
                        </div>
                        {/* Full markdown content */}
                        <div style={{ fontSize: 14, lineHeight: 1.7 }}>{renderedContent}</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
