/**
 * TickerSearchInput
 * =================
 * Reusable autocomplete input for searching and selecting stock tickers.
 * Debounced search with dropdown results showing symbol, name, and type.
 */

import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { useIsMobile } from "../../lib/useIsMobile";

interface TickerSearchInputProps {
  onSelect: (ticker: string, name: string) => void;
  placeholder?: string;
  clearOnSelect?: boolean;
  style?: React.CSSProperties;
}

export function TickerSearchInput({
  onSelect,
  placeholder = "Search ticker…",
  clearOnSelect = true,
  style,
}: TickerSearchInputProps) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string; type: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(val: string) {
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.search(val.trim());
        setResults(res.slice(0, 6));
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  function handleSelect(symbol: string, name: string) {
    if (clearOnSelect) {
      setQuery("");
    } else {
      setQuery(symbol);
    }
    setShowDropdown(false);
    setResults([]);
    onSelect(symbol, name);
  }

  const inputStyle: React.CSSProperties = {
    background: "#222",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#fff",
    padding: "5px 8px",
    fontSize: 12,
    outline: "none",
    width: "100%",
    ...style,
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        style={inputStyle}
      />
      {searching && (
        <span style={{ position: "absolute", right: 8, top: 6, fontSize: 10, color: "#555" }}>
          …
        </span>
      )}
      {showDropdown && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 2,
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: 6,
            zIndex: 200,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <div
              key={r.symbol}
              onClick={() => handleSelect(r.symbol, r.name)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                cursor: "pointer",
                fontSize: 12,
                borderBottom: "1px solid #252525",
                transition: "background 0.1s",
              }}
              onMouseEnter={isMobile ? undefined : (e) => (e.currentTarget.style.background = "#252525")}
              onMouseLeave={isMobile ? undefined : (e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: "#fff", flexShrink: 0 }}>{r.symbol}</span>
                <span
                  style={{
                    color: "#888",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.name}
                </span>
              </div>
              <span style={{ fontSize: 10, color: "#555", flexShrink: 0, marginLeft: 8 }}>
                {r.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
