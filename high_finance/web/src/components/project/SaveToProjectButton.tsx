import { useEffect, useRef, useState } from "react";
import { projectsApi } from "./api";
import type { ProjectSummary } from "../../lib/types";

interface SaveToProjectButtonProps {
  ticker: string;
  onCreateNew: () => void;
  onOpenProject: (projectId: number) => void;
}

export function SaveToProjectButton({
  ticker,
  onCreateNew,
  onOpenProject,
}: SaveToProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    projectsApi
      .listProjects()
      .then((p) => setProjects(p))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Split projects: those matching this ticker vs others
  const tickerProjects = projects.filter(
    (p) => p.ticker.toUpperCase() === ticker.toUpperCase()
  );
  const otherProjects = projects
    .filter((p) => p.ticker.toUpperCase() !== ticker.toUpperCase())
    .slice(0, 5); // Show max 5 other recent projects

  const hasExistingProject = tickerProjects.length > 0;

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: hasExistingProject ? "#22c55e20" : "#3b82f620",
          border: `1px solid ${hasExistingProject ? "#22c55e40" : "#3b82f640"}`,
          borderRadius: 8,
          color: hasExistingProject ? "#22c55e" : "#3b82f6",
          fontSize: 13,
          padding: "6px 14px",
          cursor: "pointer",
          transition: "all 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{hasExistingProject ? "📋 Project" : "📋 Save to Project"}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 10,
            minWidth: 280,
            maxHeight: 400,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {loading ? (
            <div style={{ padding: 16, opacity: 0.6, fontSize: 13 }}>
              Loading projects...
            </div>
          ) : (
            <>
              {/* Projects for this ticker */}
              {tickerProjects.length > 0 && (
                <div style={{ borderBottom: "1px solid #333" }}>
                  <div
                    style={{
                      padding: "8px 12px",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      opacity: 0.5,
                      background: "#111",
                    }}
                  >
                    {ticker} Projects
                  </div>
                  {tickerProjects.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      highlight
                      onClick={() => {
                        onOpenProject(p.id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Other recent projects */}
              {otherProjects.length > 0 && (
                <div style={{ borderBottom: "1px solid #333" }}>
                  <div
                    style={{
                      padding: "8px 12px",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      opacity: 0.5,
                      background: "#111",
                    }}
                  >
                    Recent Projects
                  </div>
                  {otherProjects.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      onClick={() => {
                        onOpenProject(p.id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Create new */}
              <button
                onClick={() => {
                  onCreateNew();
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#3b82f6",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#3b82f610")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span style={{ fontSize: 16 }}>+</span>
                Create New Project for {ticker}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  highlight,
  onClick,
}: {
  project: ProjectSummary;
  highlight?: boolean;
  onClick: () => void;
}) {
  const positionColors: Record<string, string> = {
    LONG: "#22c55e",
    SHORT: "#ef4444",
    WATCH: "#f59e0b",
  };

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "10px 12px",
        background: highlight ? "#22c55e08" : "transparent",
        border: "none",
        borderLeft: highlight ? "3px solid #22c55e" : "3px solid transparent",
        color: "#fff",
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = highlight ? "#22c55e15" : "#ffffff08")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = highlight ? "#22c55e08" : "transparent")
      }
    >
      {/* Ticker badge */}
      <span
        style={{
          fontFamily: "monospace",
          fontWeight: 600,
          fontSize: 11,
          background: "#333",
          padding: "2px 6px",
          borderRadius: 4,
          minWidth: 45,
          textAlign: "center",
        }}
      >
        {project.ticker}
      </span>

      {/* Title */}
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {project.title}
      </span>

      {/* Position badge */}
      {project.position_type && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 5px",
            borderRadius: 3,
            background: `${positionColors[project.position_type] || "#666"}20`,
            color: positionColors[project.position_type] || "#666",
          }}
        >
          {project.position_type}
        </span>
      )}
    </button>
  );
}
