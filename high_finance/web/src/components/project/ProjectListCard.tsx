import { useEffect, useState } from "react";
import { projectsApi } from "./api";
import type { ProjectSummary } from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// ProjectListCard – shown on the dashboard alongside Watchlist + Portfolio
// ═══════════════════════════════════════════════════════════════════════════════

interface ProjectListCardProps {
  onOpenProject: (projectId: number) => void;
  onCreateProject: (ticker?: string) => void;
  refreshKey?: number;
  onRefresh?: () => void;
}

export function ProjectListCard({ onOpenProject, onCreateProject, refreshKey, onRefresh }: ProjectListCardProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    projectsApi
      .listProjects(filter === "active" ? "active" : undefined)
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [filter, refreshKey]);

  const convictionColor: Record<string, string> = {
    high: "#22c55e",
    medium: "#eab308",
    low: "#888",
  };

  const positionBadge: Record<string, { label: string; color: string }> = {
    long: { label: "LONG", color: "#22c55e" },
    short: { label: "SHORT", color: "#ef4444" },
    watching: { label: "WATCH", color: "#3b82f6" },
  };

  async function handleDelete(projectId: number) {
    setDeleting(true);
    try {
      await projectsApi.deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
      setDeleteConfirmId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>📋 Research Projects</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setFilter(filter === "active" ? "all" : "active")}
            style={{
              background: "none",
              border: "1px solid #333",
              borderRadius: 4,
              color: "#888",
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {filter === "active" ? "Active" : "All"}
          </button>
          <button
            onClick={() => onCreateProject()}
            style={{
              background: "#3b82f620",
              border: "1px solid #3b82f640",
              borderRadius: 6,
              color: "#3b82f6",
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.5, fontSize: 13 }}>Loading…</div>
      )}

      {/* Empty */}
      {!loading && projects.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 13 }}>No research projects yet</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Create one from a ticker page or click "+ New" above
          </div>
        </div>
      )}

      {/* Project List */}
      {!loading && projects.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {projects.map((p) => {
            const pos = p.position_type ? positionBadge[p.position_type] : null;
            const convColor = p.conviction ? convictionColor[p.conviction] : "#666";
            const daysSinceUpdate = Math.floor(
              (Date.now() - new Date(p.updated_at).getTime()) / 86400000
            );
            const updateLabel =
              daysSinceUpdate === 0 ? "today" : daysSinceUpdate === 1 ? "yesterday" : `${daysSinceUpdate}d ago`;
            const isConfirmingDelete = deleteConfirmId === p.id;

            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  background: isConfirmingDelete ? "#2a1a1a" : "#151515",
                  border: `1px solid ${isConfirmingDelete ? "#ef444440" : "#2a2a2a"}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  transition: "all 0.15s",
                  color: "#fff",
                  position: "relative",
                }}
                className="project-row"
              >
                {/* Main clickable area */}
                <div
                  onClick={() => !isConfirmingDelete && onOpenProject(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flex: 1,
                    cursor: isConfirmingDelete ? "default" : "pointer",
                    minWidth: 0,
                  }}
                >
                  {/* Ticker */}
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#fff",
                      minWidth: 52,
                    }}
                  >
                    {p.ticker}
                  </div>

                  {/* Position badge */}
                  {pos && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: `${pos.color}15`,
                        color: pos.color,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {pos.label}
                    </span>
                  )}

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                      {p.thesis_count} thesis · {p.catalyst_count} catalysts · {p.risk_count} risks
                      <span style={{ marginLeft: 8 }}>Updated {updateLabel}</span>
                    </div>
                  </div>

                  {/* Conviction dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: convColor,
                      flexShrink: 0,
                    }}
                    title={p.conviction ? `${p.conviction} conviction` : undefined}
                  />

                  {/* Latest FV */}
                  {p.latest_fair_value != null && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: "#a855f7",
                        minWidth: 60,
                        textAlign: "right",
                      }}
                    >
                      ${p.latest_fair_value.toFixed(0)}
                    </div>
                  )}
                </div>

                {/* Delete confirmation or delete button */}
                {isConfirmingDelete ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#ef4444" }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting}
                      style={{
                        background: "#ef4444",
                        border: "none",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 11,
                        padding: "4px 8px",
                        cursor: deleting ? "not-allowed" : "pointer",
                        opacity: deleting ? 0.6 : 1,
                      }}
                    >
                      {deleting ? "..." : "Yes"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={deleting}
                      style={{
                        background: "#333",
                        border: "none",
                        borderRadius: 4,
                        color: "#aaa",
                        fontSize: 11,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(p.id);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#666",
                      fontSize: 14,
                      padding: "4px 6px",
                      cursor: "pointer",
                      opacity: 0.4,
                      transition: "opacity 0.15s",
                    }}
                    title="Delete project"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.4";
                      e.currentTarget.style.color = "#666";
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}