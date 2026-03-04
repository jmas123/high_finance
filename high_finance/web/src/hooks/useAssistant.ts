import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "../lib/api";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseAssistantReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  messages: AssistantMessage[];
  isStreaming: boolean;
  error: string | null;
  isAvailable: boolean | null; // null = still checking
  sendQuery: (query: string, currentTicker: string | null, sessionId?: string) => void;
  clearMessages: () => void;
}

export function useAssistant(): UseAssistantReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Check if assistant is available on mount
  useEffect(() => {
    api.assistantStatus()
      .then((res) => setIsAvailable(res.available))
      .catch(() => setIsAvailable(false));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsOpen(false);
  }, []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages([]);
    setError(null);
  }, []);

  const sendQuery = useCallback(
    (query: string, currentTicker: string | null, sessionId?: string) => {
      if (!query.trim() || isStreaming) return;

      // Cancel any in-flight request
      abortRef.current?.abort();

      setError(null);
      setIsStreaming(true);

      // Add user message immediately
      const userMsg: AssistantMessage = { role: "user", content: query };
      const assistantMsg: AssistantMessage = { role: "assistant", content: "" };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      // Build conversation history from previous messages (exclude the new ones)
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      abortRef.current = api.assistantQuery(
        query,
        currentTicker,
        history,
        // onChunk — append to the last (assistant) message
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return updated;
          });
        },
        // onDone
        () => {
          setIsStreaming(false);
        },
        // onError
        (err) => {
          setIsStreaming(false);
          setError(err);
          // Remove the empty assistant message on error
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && !last.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        },
        sessionId,
      );
    },
    [isStreaming, messages],
  );

  return {
    isOpen,
    open,
    close,
    toggle,
    messages,
    isStreaming,
    error,
    isAvailable,
    sendQuery,
    clearMessages,
  };
}
