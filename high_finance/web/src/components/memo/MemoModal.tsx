import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "../../lib/api";
import type { MemoSummary } from "../../lib/types";
import { renderMarkdown } from "../common/MarkdownRenderer";

// ── Modal Component ────────────────────────────────────────────────────────

interface MemoModalProps {
  ticker: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MemoModal({ ticker, isOpen, onClose }: MemoModalProps) {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMemoId, setSavedMemoId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<MemoSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Render markdown only when content changes (not on every frame during streaming)
  const renderedContent = useMemo(() => {
    if (!content) return null;
    return renderMarkdown(content);
  }, [content]);

  // Load memo history when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingHistory(true);
    api.memoHistory(ticker)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [isOpen, ticker]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  // Cleanup on unmount / close
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleGenerate = useCallback(() => {
    setContent("");
    setError(null);
    setSavedMemoId(null);
    setIsStreaming(true);
    setShowHistory(false);

    abortRef.current = api.generateMemo(
      ticker,
      (chunk) => setContent((prev) => prev + chunk),
      (id) => {
        setIsStreaming(false);
        setSavedMemoId(id);
        api.memoHistory(ticker).then(setHistory).catch(() => {});
      },
      (err) => {
        setIsStreaming(false);
        setError(err);
      },
    );
  }, [ticker]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    onClose();
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleViewHistoryMemo = useCallback(async (memoId: number) => {
    try {
      const detail = await api.memoDetail(memoId);
      setContent(detail.content);
      setSavedMemoId(detail.id);
      setShowHistory(false);
      setError(null);
    } catch {
      setError("Failed to load memo");
    }
  }, []);

  if (!isOpen) return null;

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
      onClick={handleClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 12,
          width: 720,
          maxWidth: "95vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #333",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid #333",
            background: "#161616",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "0.01em" }}>
            {ticker} Investment Memo
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            {"\u2715"}
          </button>
        </div>

        {/* ── Content Area ──────────────────────────────────────── */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 28px",
            minHeight: 300,
          }}
        >
          {showHistory ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 12 }}>
                Past Memos
              </div>
              {loadingHistory && (
                <div style={{ color: "#888", fontSize: 13 }}>Loading...</div>
              )}
              {!loadingHistory && history.length === 0 && (
                <div style={{ color: "#888", fontSize: 13 }}>
                  No memos generated yet for {ticker}.
                </div>
              )}
              {history.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleViewHistoryMemo(m.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "#222",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 8,
                    cursor: "pointer",
                    color: "#fff",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>
                    {m.content_preview}...
                  </div>
                </button>
              ))}
            </div>
          ) : content ? (
            <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              {renderedContent}
              {isStreaming && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 16,
                    background: "#f59e0b",
                    marginLeft: 2,
                    animation: "memo-cursor 1s step-end infinite",
                  }}
                />
              )}
            </div>
          ) : error ? (
            <div style={{ color: "#ef4444", fontSize: 14, padding: 20, textAlign: "center" }}>
              {error}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.6 }}>
                {"\uD83D\uDCC4"}
              </div>
              <div style={{ fontSize: 15, marginBottom: 8, color: "#aaa" }}>
                AI Investment Memo
              </div>
              <div style={{ fontSize: 13, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
                One-page analysis with bull/bear cases, key metrics,
                risk factors, and valuation range — synthesized from all loaded data.
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom Bar ────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderTop: "1px solid #333",
            background: "#161616",
          }}
        >
          <button
            onClick={handleGenerate}
            disabled={isStreaming}
            style={{
              background: isStreaming ? "#333" : "#f59e0b",
              color: isStreaming ? "#888" : "#000",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: isStreaming ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {isStreaming ? "Generating..." : content ? "Regenerate" : "Generate Memo"}
          </button>

          {content && !isStreaming && (
            <button
              onClick={handleCopy}
              style={{
                background: copied ? "#22c55e20" : "#222",
                border: `1px solid ${copied ? "#22c55e40" : "#444"}`,
                borderRadius: 8,
                color: copied ? "#22c55e" : "#aaa",
                fontSize: 13,
                padding: "8px 14px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}

          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              background: showHistory ? "#3b82f620" : "#222",
              border: `1px solid ${showHistory ? "#3b82f640" : "#444"}`,
              borderRadius: 8,
              color: showHistory ? "#3b82f6" : "#aaa",
              fontSize: 13,
              padding: "8px 14px",
              cursor: "pointer",
              marginLeft: "auto",
              transition: "all 0.15s",
            }}
          >
            History{history.length > 0 ? ` (${history.length})` : ""}
          </button>

          {savedMemoId && !isStreaming && (
            <div style={{ fontSize: 11, color: "#666" }}>
              #{savedMemoId}
            </div>
          )}
        </div>
      </div>

      {/* Cursor blink animation */}
      <style>{`
        @keyframes memo-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
