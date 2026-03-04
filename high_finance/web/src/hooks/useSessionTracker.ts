import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";

/**
 * Tracks user browsing events and sends them to the backend session tracker.
 * All tracking is fire-and-forget — never blocks navigation or UI.
 */
export function useSessionTracker() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [currentSection, setCurrentSection] = useState<string>("all");
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const prevSectionRef = useRef(currentSection);

  // Track page/ticker changes
  useEffect(() => {
    const path = location.pathname;
    if (path === prevPathRef.current) return;
    prevPathRef.current = path;

    // Detect ticker loads
    const tickerMatch = path.match(/^\/quote\/([A-Z0-9.\-]+)/i);
    if (tickerMatch) {
      api.sessionEvent(sessionId, "ticker_load", {
        ticker: tickerMatch[1].toUpperCase(),
      });
    }

    // Track top-level tab views
    const tabMap: Record<string, string> = {
      "/dashboard": "dashboard",
      "/screener": "screener",
      "/projects": "projects",
      "/signals": "signals",
      "/congress": "congress",
      "/private": "private",
      "/ai-history": "ai-history",
    };
    for (const [prefix, tab] of Object.entries(tabMap)) {
      if (path.startsWith(prefix)) {
        api.sessionEvent(sessionId, "tab_view", { tab });
        break;
      }
    }
  }, [location.pathname, sessionId]);

  // Track ticker sub-section changes
  useEffect(() => {
    if (currentSection === prevSectionRef.current) return;
    prevSectionRef.current = currentSection;

    if (currentSection && currentSection !== "all") {
      api.sessionEvent(sessionId, "tab_view", { tab: currentSection });
    }
  }, [currentSection, sessionId]);

  const trackFeatureUse = useCallback(
    (feature: string) => {
      api.sessionEvent(sessionId, "feature_use", { feature });
    },
    [sessionId],
  );

  return {
    sessionId,
    currentSection,
    setCurrentSection,
    trackFeatureUse,
  };
}
