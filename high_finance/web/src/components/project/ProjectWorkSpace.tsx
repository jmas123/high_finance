import { useEffect, useState, useCallback } from "react";
import { projectsApi } from "./api";
import type { ProjectDetail } from "./types";
import type { ProjectWorkspaceProps } from "./types";

// Extracted section components
import { ThesisSection } from "./ThesisSection";
import { CatalystsSection } from "./CatalystsSection";
import { RisksSection } from "./RisksSection";
import { PeerSetSection } from "./PeerSetSection";
import { DCFVersionsSection } from "./DCFVersionSection";
import { SourcesSection } from "./SourcesSection";
import { inputStyle, smallBtnStyle, badgeSelect } from "./sharedStyles";

// ═══════════════════════════════════════════════════════════════════════════════
// ProjectWorkspace – the full single-project research view
// ═══════════════════════════════════════════════════════════════════════════════

export function ProjectWorkspace({
  projectId,
  onBack,
  onOpenTicker,
  onOpenDCF,
  currentDCF,
  onDCFImported,
}: ProjectWorkspaceProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [editSummary, setEditSummary] = useState("");

  // Load project
  const reload = useCallback(() => {
    setLoading(true);
    projectsApi
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Project-level mutations with save indicator
  async function saveTitle() {
    if (!project || !editTitle.trim()) return;
    setSaving(true);
    try {
      const updated = await projectsApi.updateProject(project.id, { title: editTitle.trim() });
      setProject(updated);
      setEditingTitle(false);
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function saveSummary() {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await projectsApi.updateProject(project.id, { summary: editSummary });
      setProject(updated);
      setEditingSummary(false);
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!project) return;
    setSaving(true);
    try {
      const next = project.status === "active" ? "archived" : "active";
      const updated = await projectsApi.updateProject(project.id, { status: next });
      setProject(updated);
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function setConviction(value: string) {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await projectsApi.updateProject(project.id, {
        conviction: value || undefined,
      });
      setProject(updated);
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function setPosition(value: string) {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await projectsApi.updateProject(project.id, {
        position_type: value || undefined,
      });
      setProject(updated);
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }

  // Export to Excel handler
  async function handleExportToExcel() {
    if (!project) return;

    setExporting(true);
    setExportError(null);

    try {
      const blob = await projectsApi.exportProjectToExcel(project.id);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ""; // Browser uses Content-Disposition filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err.message || "Export failed";
      setExportError(msg);
      // Clear error after 5 seconds
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setExporting(false);
    }
  }

  // Render
  if (loading && !project) {
    return (
      <div style={{ textAlign: "center", padding: 60, opacity: 0.5 }}>
        Loading research project…
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ padding: 20, background: "#3b1818", border: "1px solid #7f1d1d", borderRadius: 10 }}>
        <b>Error:</b> {error}
      </div>
    );
  }

  if (!project) return null;

  const convictionColors: Record<string, string> = { high: "#22c55e", medium: "#eab308", low: "#888" };
  const positionColors: Record<string, string> = { long: "#22c55e", short: "#ef4444", watching: "#3b82f6" };

  const currentPositionColor = positionColors[project.position_type ?? ""] ?? "#444";
  const currentConvictionColor = convictionColors[project.conviction ?? ""] ?? "#444";

  const lastUpdated = new Date(project.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(145deg, #1a1a1a 0%, #141414 100%)",
          border: "1px solid #2a2a2a",
          borderRadius: 14,
          padding: 20,
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}
          >
            ← Projects
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => onOpenTicker(project.ticker)}
              style={{
                background: "#222",
                border: "1px solid #333",
                borderRadius: 6,
                color: "#aaa",
                fontSize: 11,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Full Ticker View
            </button>
            <button
              onClick={handleExportToExcel}
              disabled={exporting}
              style={{
                background: exporting ? "#1a1a1a" : "#22c55e15",
                border: `1px solid ${exporting ? "#333" : "#22c55e40"}`,
                borderRadius: 6,
                color: exporting ? "#666" : "#22c55e",
                fontSize: 11,
                padding: "4px 10px",
                cursor: exporting ? "not-allowed" : "pointer",
              }}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
            <button
              onClick={toggleStatus}
              style={{
                background: project.status === "active" ? "#22c55e15" : "#88888815",
                border: `1px solid ${project.status === "active" ? "#22c55e40" : "#44444480"}`,
                borderRadius: 6,
                color: project.status === "active" ? "#22c55e" : "#888",
                fontSize: 11,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              {project.status === "active" ? "● Active" : "○ Archived"}
            </button>
          </div>
        </div>

        {/* Ticker + Title */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            {project.ticker}
          </span>
          {editingTitle ? (
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                style={{ ...inputStyle, flex: 1, fontSize: 16 }}
              />
              <button onClick={saveTitle} style={smallBtnStyle}>
                Save
              </button>
              <button onClick={() => setEditingTitle(false)} style={{ ...smallBtnStyle, color: "#666" }}>
                ✕
              </button>
            </div>
          ) : (
            <span
              onClick={() => {
                setEditTitle(project.title);
                setEditingTitle(true);
              }}
              style={{ fontSize: 18, fontWeight: 600, cursor: "pointer", opacity: 0.9 }}
              title="Click to edit"
            >
              {project.title}
            </span>
          )}
        </div>

        {/* Badges – dropdowns */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <select
            value={project.position_type ?? ""}
            onChange={(e) => setPosition(e.target.value)}
            style={badgeSelect(currentPositionColor)}
          >
            <option value="watching">Watching</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>

          <select
            value={project.conviction ?? ""}
            onChange={(e) => setConviction(e.target.value)}
            style={badgeSelect(currentConvictionColor)}
          >
            <option value="">Set Conviction</option>
            <option value="low">Low Conviction</option>
            <option value="medium">Medium Conviction</option>
            <option value="high">High Conviction</option>
          </select>

          {/* Save Status Indicator */}
          <span style={{ fontSize: 11, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? (
              <span style={{
                color: "#f59e0b",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "2px 8px",
                borderRadius: 4,
              }}>
                ⏳ Saving...
              </span>
            ) : lastSaved ? (
              <span style={{
                color: "#22c55e",
                background: "rgba(34, 197, 94, 0.1)",
                padding: "2px 8px",
                borderRadius: 4,
              }}>
                ✓ Saved {lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            ) : (
              <span style={{ color: "#555" }}>Updated {lastUpdated}</span>
            )}
          </span>
        </div>

        {/* Export Error */}
        {exportError && (
          <div style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(245, 158, 11, 0.3)",
            background: "rgba(245, 158, 11, 0.1)",
            fontSize: 12,
            color: "#f59e0b",
          }}>
            <b>Export failed:</b> {exportError}
          </div>
        )}

        {/* Summary */}
        <div style={{ marginTop: 12 }}>
          {editingSummary ? (
            <div style={{ display: "flex", gap: 6 }}>
              <textarea
                autoFocus
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={3}
                style={{ ...inputStyle, flex: 1, resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={saveSummary} style={smallBtnStyle}>
                  Save
                </button>
                <button onClick={() => setEditingSummary(false)} style={{ ...smallBtnStyle, color: "#666" }}>
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setEditSummary(project.summary ?? "");
                setEditingSummary(true);
              }}
              style={{
                fontSize: 13,
                color: project.summary ? "#bbb" : "#555",
                cursor: "pointer",
                padding: "6px 0",
                fontStyle: project.summary ? "normal" : "italic",
              }}
            >
              {project.summary || "Click to add a summary…"}
            </div>
          )}
        </div>
      </div>

      {/* Two-column: Thesis on left, Catalysts + Risks on right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ThesisSection
          projectId={project.id}
          bullets={project.thesis_bullets}
          onUpdate={reload}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CatalystsSection
            projectId={project.id}
            catalysts={project.catalysts}
            onUpdate={reload}
          />
          <RisksSection
            projectId={project.id}
            risks={project.risks}
            onUpdate={reload}
          />
        </div>
      </div>

      {/* DCF Version History */}
      <DCFVersionsSection
        projectId={project.id}
        ticker={project.ticker}
        snapshots={project.dcf_snapshots}
        currentDCF={currentDCF}
        onUpdate={reload}
        onOpenDCF={onOpenDCF ?? onOpenTicker}
        onDCFImported={onDCFImported}
      />

      {/* Peer Set */}
      <PeerSetSection
        projectId={project.id}
        peers={project.peers}
        onUpdate={reload}
      />

      {/* Linked Sources */}
      <SourcesSection
        projectId={project.id}
        sources={project.sources}
        onUpdate={reload}
      />
    </div>
  );
}
