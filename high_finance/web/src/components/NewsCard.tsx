import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { NewsBundle } from "../lib/types";

type NewsResponse = NewsBundle;

function sentimentLabel(score: number | null) {
  if (score == null) return { label: "Neutral", color: "#6b7280" };
  if (score >= 0.2) return { label: "Positive", color: "#22c55e" };
  if (score <= -0.2) return { label: "Negative", color: "#ef4444" };
  return { label: "Neutral", color: "#6b7280" };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return ""; // Invalid date
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 0) return "Just now"; // Future date handling
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface NewsCardProps {
  ticker: string;
  initialData?: NewsResponse | null;
}

export function NewsCard({ ticker, initialData }: NewsCardProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NewsResponse | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip fetch if we have initial data from bundle (even if empty)
    if (initialData !== undefined && initialData !== null) {
      setData(initialData);
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.news(ticker);
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load news");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [ticker, initialData]);

  const sentiment = sentimentLabel(data?.avg_headline_sentiment ?? null);

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>News & Sentiment</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Headlines, filings & market narrative
          </div>
        </div>

        {/* Sentiment Badge */}
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: sentiment.color,
            border: `1px solid ${sentiment.color}`,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {sentiment.label}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 16, opacity: 0.7 }}>Loading news…</div>
      )}

      {error && (
        <div
          style={{
            padding: 10,
            background: "#3b1818",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span><b>Error:</b> {error}</span>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              api.news(ticker).then(setData).catch((e) => setError(e?.message ?? "Failed")).finally(() => setLoading(false));
            }}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: "#7f1d1d",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Headlines */}
          {data.headlines.length > 0 ? (
            <div>
              {data.headlines.slice(0, 8).map((h, i) => (
                <a
                  key={`${h.title.slice(0, 20)}-${i}`}
                  href={h.url || undefined}
                  target={h.url ? "_blank" : undefined}
                  rel={h.url ? "noreferrer" : undefined}
                  onClick={h.url ? undefined : (e) => e.preventDefault()}
                  style={{
                    cursor: h.url ? "pointer" : "default",
                    display: "block",
                    padding: "10px 0",
                    borderBottom: "1px solid #222",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 1.4,
                      marginBottom: 4,
                    }}
                  >
                    {h.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.6,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <span>{h.source ?? "News"}</span>
                    {h.published && <span>• {timeAgo(h.published)}</span>}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ padding: 16, opacity: 0.7 }}>
              No recent headlines.
            </div>
          )}

          {/* Filings placeholder */}
          {data.filings && data.filings.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Recent SEC Filings
              </div>
              {data.filings.slice(0, 5).map((f, i) => (
                <div key={`${f.form}-${f.date}-${i}`} style={{ fontSize: 12, padding: "4px 0" }}>
                  {f.form} • {f.date}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
