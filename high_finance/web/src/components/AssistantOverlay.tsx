import { useState, useRef, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { renderMarkdown } from "./common/MarkdownRenderer";
import type { AssistantMessage } from "../hooks/useAssistant";

interface AssistantOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AssistantMessage[];
  isStreaming: boolean;
  error: string | null;
  currentTicker: string | null;
  onSend: (query: string) => void;
  onClear: () => void;
}

export function AssistantOverlay({
  isOpen,
  onClose,
  messages,
  isStreaming,
  error,
  currentTicker,
  onSend,
  onClear,
}: AssistantOverlayProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    onSend(q);
  }

  if (!isOpen) return null;

  const width = isMobile ? "100%" : 420;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width,
          background: "#1a1a1a",
          borderLeft: isMobile ? "none" : "1px solid #333",
          display: "flex",
          flexDirection: "column",
          zIndex: 1000,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid #333",
            background: "#161616",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Research Assistant
            </span>
            {currentTicker && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: "#10b98120",
                  color: "#10b981",
                  borderRadius: 4,
                  fontWeight: 600,
                  fontFamily: "monospace",
                }}
              >
                {currentTicker}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {messages.length > 0 && (
              <button
                onClick={onClear}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
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
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
          }}
        >
          {messages.length === 0 && !error && (
            <EmptyState currentTicker={currentTicker} onSend={onSend} />
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={`${msg.role}-${i}`}
              message={msg}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
            />
          ))}

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "#3b181820",
                border: "1px solid #7f1d1d",
                borderRadius: 8,
                color: "#ef4444",
                fontSize: 13,
                marginTop: 8,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 18px",
            borderTop: "1px solid #333",
            background: "#161616",
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              currentTicker
                ? `Ask about ${currentTicker}...`
                : "Ask a question..."
            }
            maxLength={2000}
            disabled={isStreaming}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            style={{
              padding: "10px 16px",
              background: isStreaming || !input.trim() ? "#333" : "#10b981",
              color: isStreaming || !input.trim() ? "#666" : "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </form>
      </div>
    </>
  );
}


// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isLast,
  isStreaming,
}: {
  message: AssistantMessage;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";

  const renderedContent = useMemo(() => {
    if (isUser || !message.content) return null;
    return renderMarkdown(message.content);
  }, [message.content, isUser]);

  return (
    <div
      style={{
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "90%",
          padding: isUser ? "8px 14px" : "10px 14px",
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          background: isUser ? "#10b98120" : "#222",
          border: isUser ? "1px solid #10b98130" : "1px solid #333",
          color: "#fff",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {isUser ? (
          <span>{message.content}</span>
        ) : (
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {renderedContent || (
              <span style={{ color: "#666" }}>Thinking...</span>
            )}
            {isStreaming && isLast && (
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 14,
                  background: "#10b981",
                  marginLeft: 2,
                  animation: "assistant-cursor 1s step-end infinite",
                  verticalAlign: "text-bottom",
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Empty State with Suggestions ──────────────────────────────────────────

function EmptyState({
  currentTicker,
  onSend,
}: {
  currentTicker: string | null;
  onSend: (query: string) => void;
}) {
  const suggestions = currentTicker
    ? [
        `What are the key risks for ${currentTicker}?`,
        `Summarize the bull and bear case for ${currentTicker}`,
        `How does ${currentTicker}'s valuation compare to peers?`,
        `What does the insider trading activity suggest?`,
      ]
    : [
        "What should I look for in a company's financials?",
        "Explain the difference between P/E and EV/EBITDA",
        "How do I interpret institutional ownership changes?",
        "What are the key risk metrics to watch?",
      ];

  return (
    <div style={{ padding: "20px 0", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>
        {"\uD83E\uDD16"}
      </div>
      <div style={{ fontSize: 14, color: "#aaa", marginBottom: 4 }}>
        Research Assistant
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 20, maxWidth: 280, margin: "0 auto 20px" }}>
        {currentTicker
          ? `Ask anything about ${currentTicker} — I have all the loaded data.`
          : "Ask about investing concepts, financial metrics, or analysis techniques."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 8px" }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            style={{
              padding: "10px 14px",
              background: "#222",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#ccc",
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
              lineHeight: 1.4,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Cursor blink animation */}
      <style>{`
        @keyframes assistant-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
