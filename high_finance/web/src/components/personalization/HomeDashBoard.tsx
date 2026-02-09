import { useState, useEffect } from "react";
import { PortfolioCard } from "./PortfolioCard";
import { WatchlistCard } from "./WatchlistCard";
import { projectsApi } from "../project/api";
import type { ProjectSummary } from "../../lib/types";
import { getRecentTickers, getWatchlist, getPortfolio, exportAllData, importAllData, clearAllData } from "./storage";
import { InfoTip } from "../common/InfoTip";
import { DASHBOARD_TIPS } from "../../lib/tooltips";
import { useIsMobile } from "../../lib/useIsMobile";

interface HomeDashboardProps {
  onSelect: (ticker: string) => void;
  onOpenProject?: (projectId: number) => void;
  isAuthenticated?: boolean;
}

export function HomeDashboard({
  onSelect,
  onOpenProject,
  isAuthenticated = false,
}: HomeDashboardProps) {
  const isMobile = useIsMobile();
  const [recentTickers, setRecentTickers] = useState<string[]>([]);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [activeProjects, setActiveProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    setRecentTickers(getRecentTickers());
  }, []);

  // Fetch active projects (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveProjects([]);
      return;
    }
    projectsApi
      .listProjects("active")
      .then((projects) => setActiveProjects(projects.slice(0, 5)))
      .catch(() => setActiveProjects([]));
  }, [isAuthenticated]);

  function handleExport() {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `high_finance_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDataMenu(false);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const success = importAllData(reader.result as string);
        if (success) {
          setRecentTickers(getRecentTickers());
          window.location.reload(); // easiest way to refresh all state
        } else {
          alert("Invalid backup file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setShowDataMenu(false);
  }

  function handleClear() {
    if (confirm("This will delete your watchlist, portfolio, and recent tickers. Continue?")) {
      clearAllData();
      window.location.reload();
    }
    setShowDataMenu(false);
  }

  return (
    <div>
      {/* Welcome Header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff" }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
            Your watchlist, portfolio, and recent activity
          </p>
        </div>

        {/* Data management */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowDataMenu(!showDataMenu)}
            style={{
              background: "#222",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#888",
              fontSize: 12,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            ⚙ Data
          </button>
          {showDataMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
                padding: 4,
                zIndex: 100,
                minWidth: 160,
              }}
            >
              <button onClick={handleExport} style={menuItem}>
                📥 Export Backup
              </button>
              <button onClick={handleImport} style={menuItem}>
                📤 Import Backup
              </button>
              <div style={{ borderTop: "1px solid #333", margin: "4px 0" }} />
              <button onClick={handleClear} style={{ ...menuItem, color: "#ef4444" }}>
                🗑 Clear All Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty-state hero for first-time visitors */}
      {recentTickers.length === 0 && getWatchlist().length === 0 && getPortfolio().length === 0 && activeProjects.length === 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid #333",
            borderRadius: 12,
            padding: isMobile ? "24px 16px" : "40px 32px",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            High Finance
          </div>
          <p style={{ fontSize: 15, color: "#999", maxWidth: 480, margin: "0 auto 24px" }}>
            AI-powered equity research. Search any ticker to get fundamentals, risk analysis, congressional trades, and DCF valuation.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {["AAPL", "NVDA", "MSFT", "JPM", "TSLA"].map((t) => (
              <button
                key={t}
                onClick={() => onSelect(t)}
                style={{
                  background: "#3b82f620",
                  border: "1px solid #3b82f640",
                  borderRadius: 8,
                  color: "#3b82f6",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "monospace",
                  padding: "8px 20px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={isMobile ? undefined : (e) => {
                  e.currentTarget.style.background = "#3b82f630";
                  e.currentTarget.style.borderColor = "#3b82f680";
                }}
                onMouseLeave={isMobile ? undefined : (e) => {
                  e.currentTarget.style.background = "#3b82f620";
                  e.currentTarget.style.borderColor = "#3b82f640";
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two Column: Watchlist + Portfolio */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 16, marginBottom: 20 }}>
        <WatchlistCard onSelect={onSelect} onOpenProject={onOpenProject} />
        <PortfolioCard onSelect={onSelect} />
      </div>

      {/* Active Projects */}
      {activeProjects.length > 0 && (
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Active Research</span>
              <span style={{ fontSize: 11, color: "#666" }}>({activeProjects.length})</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {activeProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onOpen={() => onOpenProject?.(project.id)}
                onOpenTicker={() => onSelect(project.ticker)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Tickers */}
      {recentTickers.length > 0 && (
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10 }}>
            🕐 Recent
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recentTickers.map((t) => (
              <button
                key={t}
                onClick={() => onSelect(t)}
                style={{
                  background: "#222",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#ccc",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "monospace",
                  padding: "6px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={isMobile ? undefined : (e) => {
                  e.currentTarget.style.background = "#2a2a2a";
                  e.currentTarget.style.borderColor = "#555";
                }}
                onMouseLeave={isMobile ? undefined : (e) => {
                  e.currentTarget.style.background = "#222";
                  e.currentTarget.style.borderColor = "#333";
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  color: "#ccc",
  fontSize: 12,
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: 4,
};

const positionColors: Record<string, string> = {
  LONG: "#22c55e",
  SHORT: "#ef4444",
  WATCH: "#f59e0b",
};

function ProjectRow({
  project,
  onOpen,
  onOpenTicker,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onOpenTicker: () => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={isMobile ? undefined : (e) => (e.currentTarget.style.background = "#252525")}
      onMouseLeave={isMobile ? undefined : (e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Ticker */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenTicker();
        }}
        style={{
          fontFamily: "monospace",
          fontWeight: 600,
          fontSize: 12,
          background: "#333",
          border: "none",
          padding: "4px 8px",
          borderRadius: 4,
          color: "#fff",
          cursor: "pointer",
          minWidth: 50,
          textAlign: "center",
        }}
        title={`Open ${project.ticker} analysis`}
      >
        {project.ticker}
      </button>

      {/* Title */}
      <div
        style={{
          fontSize: 13,
          color: "#ccc",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {project.title}
      </div>

      {/* Position badge */}
      {project.position_type && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 3,
            background: `${positionColors[project.position_type] || "#666"}20`,
            color: positionColors[project.position_type] || "#666",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {project.position_type}
          <InfoTip text={DASHBOARD_TIPS[project.position_type.toLowerCase()] || "Position type for this research project."} />
        </span>
      )}
    </div>
  );
}