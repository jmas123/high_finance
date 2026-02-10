import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = "(max-width: 768px)";
const LARGE_SCREEN_BREAKPOINT = "(min-width: 1440px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_BREAKPOINT);
}

export function useIsLargeScreen(): boolean {
  return useMediaQuery(LARGE_SCREEN_BREAKPOINT);
}
