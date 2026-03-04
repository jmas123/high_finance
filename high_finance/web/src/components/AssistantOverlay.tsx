import { useState, useRef, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { renderMarkdown } from "./common/MarkdownRenderer";
import type { AssistantMessage } from "../hooks/useAssistant";

type ActionType = "dcf" | "memo" | "risk";

interface AssistantOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AssistantMessage[];
  isStreaming: boolean;
  error: string | null;
  currentTicker: string | null;
  currentSection: string;
  onSend: (query: string) => void;
  onClear: () => void;
  onRunDCF?: () => void;
  onRunMemo?: () => void;
  onRunRisk?: () => void;
  onOpenScreener?: (filters: Record<string, unknown>) => void;
}

export function AssistantOverlay({
  isOpen,
  onClose,
  messages,
  isStreaming,
  error,
  currentTicker,
  currentSection,
  onSend,
  onClear,
  onRunDCF,
  onRunMemo,
  onRunRisk,
  onOpenScreener,
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

  function handleAction(action: ActionType) {
    if (action === "dcf") onRunDCF?.();
    else if (action === "memo") onRunMemo?.();
    else if (action === "risk") onRunRisk?.();
  }

  if (!isOpen) return null;

  const width = isMobile ? "100%" : 420;

  // Build placeholder based on section
  const placeholder = currentTicker
    ? currentSection && currentSection !== "all"
      ? `Ask about ${currentTicker} ${currentSection}...`
      : `Ask about ${currentTicker}...`
    : "Ask a question...";

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
            <EmptyState
              currentTicker={currentTicker}
              currentSection={currentSection}
              onSend={onSend}
            />
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={`${msg.role}-${i}`}
              message={msg}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
              onAction={handleAction}
              onScreenAction={onOpenScreener}
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
            placeholder={placeholder}
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


// ── Action marker parsing ─────────────────────────────────────────────────

const ACTION_RE = /\[ACTION:(dcf|memo|risk)\]\s*$/;

function parseAction(content: string): { text: string; action: ActionType | null } {
  const match = content.match(ACTION_RE);
  if (!match) return { text: content, action: null };
  return {
    text: content.replace(ACTION_RE, "").trimEnd(),
    action: match[1] as ActionType,
  };
}

const ACTION_LABELS: Record<ActionType, { label: string; color: string }> = {
  dcf: { label: "Run DCF Analysis", color: "#10b981" },
  memo: { label: "Generate Investment Memo", color: "#f59e0b" },
  risk: { label: "Run Risk Assessment", color: "#ef4444" },
};


// ── Screen marker parsing ─────────────────────────────────────────────────

const SCREEN_RE = /\[SCREEN:(\{.*\})\]\s*$/s;

function parseScreenAction(content: string): {
  text: string;
  screenFilters: Record<string, unknown> | null;
} {
  const match = content.match(SCREEN_RE);
  if (!match) return { text: content, screenFilters: null };
  try {
    const filters = JSON.parse(match[1]);
    return {
      text: content.replace(SCREEN_RE, "").trimEnd(),
      screenFilters: filters,
    };
  } catch {
    // Malformed JSON — hide the marker but don't show button
    return { text: content.replace(SCREEN_RE, "").trimEnd(), screenFilters: null };
  }
}


// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isLast,
  isStreaming,
  onAction,
  onScreenAction,
}: {
  message: AssistantMessage;
  isLast: boolean;
  isStreaming: boolean;
  onAction: (action: ActionType) => void;
  onScreenAction?: (filters: Record<string, unknown>) => void;
}) {
  const isUser = message.role === "user";

  const { renderedContent, action, screenFilters } = useMemo(() => {
    if (isUser || !message.content)
      return { renderedContent: null, action: null, screenFilters: null };
    // Parse action markers first, then screen markers
    const { text: afterAction, action } = parseAction(message.content);
    const { text: finalText, screenFilters } = parseScreenAction(afterAction);
    return { renderedContent: renderMarkdown(finalText), action, screenFilters };
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

      {/* Action button (only for completed assistant messages with an action marker) */}
      {!isUser && action && !isStreaming && (
        <button
          onClick={() => onAction(action)}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            background: `${ACTION_LABELS[action].color}20`,
            border: `1px solid ${ACTION_LABELS[action].color}40`,
            borderRadius: 8,
            color: ACTION_LABELS[action].color,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {ACTION_LABELS[action].label}
        </button>
      )}

      {/* Screen button (only for completed assistant messages with a screen marker) */}
      {!isUser && screenFilters && !isStreaming && onScreenAction && (
        <button
          onClick={() => onScreenAction(screenFilters)}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            background: "#3b82f620",
            border: "1px solid #3b82f640",
            borderRadius: 8,
            color: "#3b82f6",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          View in Screener
        </button>
      )}
    </div>
  );
}


// ── Contextual suggestion map ─────────────────────────────────────────────

const SECTION_SUGGESTIONS: Record<string, (ticker: string) => string[]> = {
  valuation: (t) => [
    `Any red flags in ${t}'s valuation?`,
    `How does ${t} compare to peers?`,
    `Run a DCF for ${t}`,
  ],
  financials: (t) => [
    `Revenue trend analysis for ${t}`,
    `Margin breakdown for ${t}`,
    `Generate a memo for ${t}`,
  ],
  ownership: (t) => [
    `Summarize insider activity for ${t}`,
    `Any unusual institutional moves in ${t}?`,
    `Who's buying ${t}?`,
  ],
  options: (t) => [
    `What does options flow suggest for ${t}?`,
    `Unusual options activity in ${t}?`,
    `Expected move analysis for ${t}`,
  ],
  context: (t) => [
    `Summarize recent ${t} news`,
    `Any concerning headlines for ${t}?`,
    `Sentiment analysis for ${t}`,
  ],
  leadership: (t) => [
    `Key management changes at ${t}?`,
    `Executive compensation concerns for ${t}?`,
    `Summarize ${t} leadership`,
  ],
};


// ── Empty State with Suggestions ──────────────────────────────────────────

function EmptyState({
  currentTicker,
  currentSection,
  onSend,
}: {
  currentTicker: string | null;
  currentSection: string;
  onSend: (query: string) => void;
}) {
  const suggestions = useMemo(() => {
    if (currentTicker) {
      // Check for section-specific suggestions
      const sectionFn = SECTION_SUGGESTIONS[currentSection];
      if (sectionFn) {
        return sectionFn(currentTicker);
      }
      // Default ticker suggestions (for "all" tab or unknown sections)
      return [
        `What are the key risks for ${currentTicker}?`,
        `Summarize the bull and bear case for ${currentTicker}`,
        `How does ${currentTicker}'s valuation compare to peers?`,
        `What does the insider trading activity suggest?`,
      ];
    }
    return [
      "What should I look for in a company's financials?",
      "Explain the difference between P/E and EV/EBITDA",
      "How do I interpret institutional ownership changes?",
      "What are the key risk metrics to watch?",
    ];
  }, [currentTicker, currentSection]);

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
