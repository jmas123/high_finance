import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

interface SearchBarProps {
  onSelect: (ticker: string) => void;
  loading: boolean;
}

export function SearchBar({ onSelect, loading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true); // Show searching state immediately
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const searchResults = await api.search(query);
        setResults(searchResults);
        setShowResults(searchResults.length > 0); // Only show if we have results
        setSelectedIndex(-1);
        setSearchError(null);
      } catch (e) {
        console.error("Search error:", e);
        setSearchError("Search unavailable — try again or enter a ticker directly");
        setResults([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    }, 300); // Slightly longer debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(symbol: string) {
    justSelectedRef.current = true;
    setQuery(symbol);
    setResults([]);
    setShowResults(false);
    inputRef.current?.blur();
    onSelect(symbol);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex].symbol);
      } else if (query.trim()) {
        handleSelect(query.trim().toUpperCase());
      }
    } else if (e.key === "Escape") {
      setShowResults(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ 
        display: "flex", 
        gap: 12, 
        alignItems: "center", 
        padding: 16,
        background: "#1a1a1a",
        borderRadius: showResults && results.length > 0 ? "10px 10px 0 0" : 10,
        border: "1px solid #333",
        borderBottom: showResults && results.length > 0 ? "1px solid #333" : undefined,
        width: "100%",
        boxSizing: "border-box"
      }}>
        <span style={{ opacity: 0.6, fontSize: 20 }}>
          {searching ? "⏳" : "🔍"}
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search by ticker or company name..."
          style={{ 
            padding: 10, 
            fontSize: 16, 
            flex: 1,
            background: "transparent", 
            border: "none", 
            color: "#fff",
            outline: "none"
          }}
        />
        <button
          onClick={() => query.trim() && handleSelect(query.trim().toUpperCase())}
          disabled={loading || !query.trim()}
          style={{ 
            padding: "10px 24px", 
            fontSize: 14, 
            cursor: loading || !query.trim() ? "not-allowed" : "pointer", 
            background: loading || !query.trim() ? "#555" : "#3b82f6", 
            color: "#fff", 
            border: "none", 
            borderRadius: 6,
            fontWeight: 600,
            opacity: loading || !query.trim() ? 0.7 : 1,
          }}
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {/* Search error message */}
      {searchError && !showResults && (
        <div style={{
          padding: "8px 16px",
          fontSize: 13,
          color: "#f87171",
          background: "#1a1a1a",
          borderLeft: "1px solid #333",
          borderRight: "1px solid #333",
          borderBottom: "1px solid #333",
          borderRadius: "0 0 10px 10px",
        }}>
          {searchError}
        </div>
      )}

      {/* Search Results Dropdown - only show when we have results */}
      {showResults && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#1a1a1a",
          border: "1px solid #333",
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          maxHeight: 320,
          overflowY: "auto",
          zIndex: 100,
        }}>
          {results.map((result, index) => (
            <div
              key={result.symbol}
              onClick={() => handleSelect(result.symbol)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                background: index === selectedIndex ? "#2a2a2a" : "transparent",
                borderBottom: index < results.length - 1 ? "1px solid #222" : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "background 0.1s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{result.symbol}</span>
                  <span style={{ 
                    fontSize: 10, 
                    padding: "2px 6px", 
                    background: result.type === "ETF" ? "#8b5cf6" : "#3b82f6",
                    borderRadius: 4,
                    opacity: 0.8
                  }}>
                    {result.type}
                  </span>
                </div>
                <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>
                  {result.name}
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.4 }}>
                {result.exchange}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}