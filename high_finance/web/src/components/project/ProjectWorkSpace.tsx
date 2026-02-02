import { useEffect, useState, useCallback } from "react";
import { projectsApi } from "./api";
import type {
  ProjectDetail,
  ThesisBullet,
  Catalyst,
  ProjectRiskItem,
  ProjectPeer,
  DCFSnapshot,
  ProjectSourceItem,
  CatalystStatus,
  RiskSeverity,
} from "./types";

import type { ProjectWorkspaceProps } from "./types";
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

  // ── Editing states ───────────────────────────────────────────────────────
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [editSummary, setEditSummary] = useState("");

  // ── Load project ─────────────────────────────────────────────────────────
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

  // ── Project-level mutations ──────────────────────────────────────────────
  async function saveTitle() {
    if (!project || !editTitle.trim()) return;
    const updated = await projectsApi.updateProject(project.id, { title: editTitle.trim() });
    setProject(updated);
    setEditingTitle(false);
  }

  async function saveSummary() {
    if (!project) return;
    const updated = await projectsApi.updateProject(project.id, { summary: editSummary });
    setProject(updated);
    setEditingSummary(false);
  }

  async function toggleStatus() {
    if (!project) return;
    const next = project.status === "active" ? "archived" : "active";
    const updated = await projectsApi.updateProject(project.id, { status: next });
    setProject(updated);
  }

  async function setConviction(value: string) {
    if (!project) return;
    const updated = await projectsApi.updateProject(project.id, {
      conviction: value || undefined,
    });
    setProject(updated);
  }

  async function setPosition(value: string) {
    if (!project) return;
    const updated = await projectsApi.updateProject(project.id, {
      position_type: value || undefined,
    });
    setProject(updated);
  }

  // ── Render ───────────────────────────────────────────────────────────────
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
      {/* ── Header ────────────────────────────────────────────────────────── */}
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
              📊 Full Ticker View
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

        {/* Badges – now dropdowns */}
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

          <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>Updated {lastUpdated}</span>
        </div>

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

      {/* ── Two-column: Thesis on left, Catalysts + Risks on right ──────── */}
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

      {/* ── DCF Version History ─────────────────────────────────────────── */}
      <DCFVersionsSection
        projectId={project.id}
        ticker={project.ticker}
        snapshots={project.dcf_snapshots}
        currentDCF={currentDCF}
        onUpdate={reload}
        onOpenDCF={onOpenDCF ?? onOpenTicker}
        onDCFImported={onDCFImported}
      />

      {/* ── Peer Set ────────────────────────────────────────────────────── */}
      <PeerSetSection
        projectId={project.id}
        peers={project.peers}
        onUpdate={reload}
      />

      {/* ── Linked Sources ──────────────────────────────────────────────── */}
      <SourcesSection
        projectId={project.id}
        sources={project.sources}
        onUpdate={reload}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// THESIS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function ThesisSection({
  projectId,
  bullets,
  onUpdate,
}: {
  projectId: number;
  bullets: ThesisBullet[];
  onUpdate: () => void;
}) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  async function addBullet() {
    if (!newText.trim() || saving) return;
    setSaving(true);
    try {
      await projectsApi.addThesis(projectId, newText.trim(), bullets.length);
      setNewText("");
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function saveBullet(id: number) {
    if (!editText.trim()) return;
    await projectsApi.updateThesis(projectId, id, { text: editText.trim() });
    setEditingId(null);
    onUpdate();
  }

  async function removeBullet(id: number) {
    await projectsApi.deleteThesis(projectId, id);
    onUpdate();
  }

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <span>💡 Thesis</span>
        <span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>{bullets.length} points</span>
      </div>

      {bullets.length === 0 && (
        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", marginBottom: 8 }}>
          No thesis bullets yet — what's the core investment rationale?
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bullets.map((b) => (
          <div
            key={b.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "8px 10px",
              background: "#151515",
              borderRadius: 6,
              border: "1px solid #222",
            }}
          >
            <span style={{ color: "#3b82f6", fontSize: 14, lineHeight: "20px", flexShrink: 0 }}>•</span>
            {editingId === b.id ? (
              <div style={{ flex: 1, display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveBullet(b.id)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => saveBullet(b.id)} style={smallBtnStyle}>✓</button>
                <button onClick={() => setEditingId(null)} style={{ ...smallBtnStyle, color: "#666" }}>✕</button>
              </div>
            ) : (
              <>
                <span
                  style={{ flex: 1, fontSize: 13, lineHeight: "20px", cursor: "pointer" }}
                  onClick={() => {
                    setEditingId(b.id);
                    setEditText(b.text);
                  }}
                >
                  {b.text}
                </span>
                <button
                  onClick={() => removeBullet(b.id)}
                  style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: 0, flexShrink: 0 }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          placeholder="Add a thesis bullet…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBullet()}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={addBullet}
          disabled={saving || !newText.trim()}
          style={{
            ...smallBtnStyle,
            opacity: newText.trim() ? 1 : 0.4,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CATALYSTS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function CatalystsSection({
  projectId,
  catalysts,
  onUpdate,
}: {
  projectId: number;
  catalysts: Catalyst[];
  onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  async function addCatalyst() {
    if (!newTitle.trim()) return;
    await projectsApi.addCatalyst(projectId, {
      title: newTitle.trim(),
      expected_date: newDate || undefined,
    });
    setNewTitle("");
    setNewDate("");
    setShowAdd(false);
    onUpdate();
  }

  async function cycleStatus(cat: Catalyst) {
    const cycle: CatalystStatus[] = ["pending", "occurred", "missed"];
    const idx = cycle.indexOf(cat.status);
    const next = cycle[(idx + 1) % cycle.length];
    await projectsApi.updateCatalyst(projectId, cat.id, { status: next });
    onUpdate();
  }

  async function removeCatalyst(id: number) {
    await projectsApi.deleteCatalyst(projectId, id);
    onUpdate();
  }

  const statusIcon: Record<string, string> = { pending: "○", occurred: "✓", missed: "✗" };
  const statusColor: Record<string, string> = { pending: "#eab308", occurred: "#22c55e", missed: "#ef4444" };

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <span>🎯 Catalysts</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ ...smallBtnStyle, fontSize: 11 }}>
          + Add
        </button>
      </div>

      {catalysts.length === 0 && !showAdd && (
        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
          No catalysts yet — what events could drive this?
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {catalysts.map((cat) => {
          const dateStr = cat.expected_date
            ? new Date(cat.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null;
          const isPast = cat.expected_date ? new Date(cat.expected_date) < new Date() : false;

          return (
            <div
              key={cat.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: "#151515",
                borderRadius: 6,
                border: `1px solid ${cat.status === "pending" && isPast ? "#eab30830" : "#222"}`,
              }}
            >
              <button
                onClick={() => cycleStatus(cat)}
                style={{
                  background: "none",
                  border: "none",
                  color: statusColor[cat.status],
                  fontSize: 14,
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 700,
                }}
                title={`Status: ${cat.status} (click to cycle)`}
              >
                {statusIcon[cat.status]}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: cat.status !== "pending" ? "line-through" : "none",
                    opacity: cat.status !== "pending" ? 0.5 : 1,
                  }}
                >
                  {cat.title}
                </div>
                {dateStr && (
                  <div
                    style={{
                      fontSize: 10,
                      color: isPast && cat.status === "pending" ? "#eab308" : "#666",
                      marginTop: 2,
                    }}
                  >
                    {dateStr}
                    {isPast && cat.status === "pending" && " • overdue"}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeCatalyst(cat.id)}
                style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: 0 }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
          <input
            autoFocus
            placeholder="Catalyst title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCatalyst()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            style={{ ...inputStyle, width: 130 }}
          />
          <button onClick={addCatalyst} disabled={!newTitle.trim()} style={smallBtnStyle}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// RISKS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function RisksSection({
  projectId,
  risks,
  onUpdate,
}: {
  projectId: number;
  risks: ProjectRiskItem[];
  onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeverity, setNewSeverity] = useState<RiskSeverity>("medium");

  async function addRisk() {
    if (!newTitle.trim()) return;
    await projectsApi.addRisk(projectId, { title: newTitle.trim(), severity: newSeverity });
    setNewTitle("");
    setNewSeverity("medium");
    setShowAdd(false);
    onUpdate();
  }

  async function cycleSeverity(risk: ProjectRiskItem) {
    const cycle: RiskSeverity[] = ["low", "medium", "high"];
    const idx = cycle.indexOf(risk.severity);
    const next = cycle[(idx + 1) % cycle.length];
    await projectsApi.updateRisk(projectId, risk.id, { severity: next });
    onUpdate();
  }

  async function toggleMitigated(risk: ProjectRiskItem) {
    const next = risk.status === "active" ? "mitigated" : risk.status === "mitigated" ? "realized" : "active";
    await projectsApi.updateRisk(projectId, risk.id, { status: next });
    onUpdate();
  }

  async function removeRisk(id: number) {
    await projectsApi.deleteRisk(projectId, id);
    onUpdate();
  }

  const sevColor: Record<string, string> = { high: "#ef4444", medium: "#eab308", low: "#888" };
  const sevIcon: Record<string, string> = { high: "▲", medium: "◆", low: "▽" };

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <span>⚠️ Risks</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ ...smallBtnStyle, fontSize: 11 }}>
          + Add
        </button>
      </div>

      {risks.length === 0 && !showAdd && (
        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
          No risks documented — what could go wrong?
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {risks.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "#151515",
              borderRadius: 6,
              border: `1px solid ${r.severity === "high" && r.status === "active" ? "#ef444430" : "#222"}`,
              opacity: r.status !== "active" ? 0.5 : 1,
            }}
          >
            <button
              onClick={() => cycleSeverity(r)}
              style={{
                background: "none",
                border: "none",
                color: sevColor[r.severity],
                fontSize: 10,
                cursor: "pointer",
                padding: 0,
              }}
              title={`Severity: ${r.severity} (click to cycle)`}
            >
              {sevIcon[r.severity]}
            </button>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                textDecoration: r.status !== "active" ? "line-through" : "none",
                cursor: "pointer",
              }}
              onClick={() => toggleMitigated(r)}
            >
              {r.title}
            </span>
            {r.status !== "active" && (
              <span style={{ fontSize: 9, color: r.status === "mitigated" ? "#22c55e" : "#ef4444", fontWeight: 600, letterSpacing: "0.5px" }}>
                {r.status.toUpperCase()}
              </span>
            )}
            <button
              onClick={() => removeRisk(r.id)}
              style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: 0 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
          <input
            autoFocus
            placeholder="Risk description…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRisk()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as RiskSeverity)}
            style={{ ...inputStyle, width: 90 }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button onClick={addRisk} disabled={!newTitle.trim()} style={smallBtnStyle}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// PEER SET SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function PeerSetSection({
  projectId,
  peers,
  onUpdate,
}: {
  projectId: number;
  peers: ProjectPeer[];
  onUpdate: () => void;
}) {
  const [newTicker, setNewTicker] = useState("");

  // NEW: days selector + returns cache
  const [days, setDays] = useState(30);
  const [returnsByTicker, setReturnsByTicker] = useState<Record<string, number | null>>({});
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  async function addPeer() {
    const t = newTicker.trim().toUpperCase();
    if (!t) return;
    if (peers.some((p) => p.ticker === t)) {
      setNewTicker("");
      return;
    }
    await projectsApi.addPeer(projectId, t);
    setNewTicker("");
    onUpdate();
  }

  async function removePeer(peerId: number) {
    await projectsApi.removePeer(projectId, peerId);
    onUpdate();
  }

  // NEW: fetch % moves any time peers or days changes
  useEffect(() => {
    const tickers = peers.map((p) => p.ticker).filter(Boolean);
    if (tickers.length === 0) {
      setReturnsByTicker({});
      setReturnsError(null);
      return;
    }

    let cancelled = false;
    setReturnsLoading(true);
    setReturnsError(null);

    projectsApi
      .getReturns(tickers, days) // <- add helper below (or swap to your endpoint)
      .then((map) => {
        if (cancelled) return;
        // normalize to uppercase keys
        const normalized: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(map ?? {})) {
          normalized[k.toUpperCase()] = v == null ? null : Number(v);
        }
        setReturnsByTicker(normalized);
      })
      .catch((e) => {
        if (cancelled) return;
        setReturnsError(e?.message ?? "Failed to load peer moves");
      })
      .finally(() => {
        if (cancelled) return;
        setReturnsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [peers, days]);

  function fmtMove(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return "—";
    const pct = v * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  }

  function moveColor(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return "#666";
    return v >= 0 ? "#22c55e" : "#ef4444";
  }

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span>🔒 Peer Set</span>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>
            Locked for consistent comps
          </span>
        </div>

        {/* NEW: days selector in top-right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#666" }}>Move</span>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ ...inputStyle, width: 90, fontSize: 11 }}
            title="Time window for peer performance"
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
          </select>
        </div>
      </div>

      {/* Optional tiny status line */}
      {(returnsLoading || returnsError) && (
        <div style={{ fontSize: 11, color: returnsError ? "#ef4444" : "#666", marginBottom: 8 }}>
          {returnsError ? returnsError : "Loading moves…"}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {peers.map((p) => {
          const mv = returnsByTicker[p.ticker?.toUpperCase() ?? ""] ?? null;
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: 6,
              }}
            >
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                {p.ticker}
              </span>

              {/* NEW: move badge */}
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: moveColor(mv),
                  background: `${moveColor(mv)}12`,
                  border: `1px solid ${moveColor(mv)}28`,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
                title={`Percent move over the past ${days} days`}
              >
                {fmtMove(mv)}
              </span>

              <button
                onClick={() => removePeer(p.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#555",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                  marginLeft: 2,
                }}
                title="Remove peer"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Inline add */}
        <div style={{ display: "flex", gap: 4 }}>
          <input
            placeholder="Add ticker…"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addPeer()}
            style={{ ...inputStyle, width: 90, fontFamily: "monospace" }}
          />
          <button
            onClick={addPeer}
            disabled={!newTicker.trim()}
            style={{ ...smallBtnStyle, opacity: newTicker.trim() ? 1 : 0.4 }}
          >
            +
          </button>
        </div>
      </div>

      {peers.length === 0 && (
        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", marginTop: 6 }}>
          Add comparable tickers to lock a consistent peer set for relative valuation.
        </div>
      )}
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// DCF VERSIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const defaultDCFInputs = {
  growth: "10",
  margin: "20",
  tax: "21",
  wacc: "10",
  terminal_g: "2.5",
  fair_value: "",
  enterprise_value: "",
  current_price: "",
};

function DCFVersionsSection({
  projectId,
  ticker,
  snapshots,
  currentDCF,
  onUpdate,
  onOpenDCF,
  onDCFImported,
}: {
  projectId: number;
  ticker: string;
  snapshots: DCFSnapshot[];
  currentDCF?: ProjectWorkspaceProps["currentDCF"];
  onUpdate: () => void;
  onOpenDCF: (ticker: string) => void;
  onDCFImported?: () => void;
}) {
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // ── Import-from-model state ───────────────────────────────────────────
  const [showImportForm, setShowImportForm] = useState(false);
  const [importLabel, setImportLabel] = useState("");
  const [importNotes, setImportNotes] = useState("");

  // ── Manual form fields (stored as display strings, e.g. "10" = 10%) ───
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [formGrowth, setFormGrowth] = useState(defaultDCFInputs.growth);
  const [formMargin, setFormMargin] = useState(defaultDCFInputs.margin);
  const [formTax, setFormTax] = useState(defaultDCFInputs.tax);
  const [formWacc, setFormWacc] = useState(defaultDCFInputs.wacc);
  const [formTermG, setFormTermG] = useState(defaultDCFInputs.terminal_g);
  const [formFV, setFormFV] = useState(defaultDCFInputs.fair_value);
  const [formEV, setFormEV] = useState(defaultDCFInputs.enterprise_value);
  const [formPrice, setFormPrice] = useState(defaultDCFInputs.current_price);

  function resetManualForm() {
    setLabel("");
    setNotes("");
    setFormGrowth(defaultDCFInputs.growth);
    setFormMargin(defaultDCFInputs.margin);
    setFormTax(defaultDCFInputs.tax);
    setFormWacc(defaultDCFInputs.wacc);
    setFormTermG(defaultDCFInputs.terminal_g);
    setFormFV(defaultDCFInputs.fair_value);
    setFormEV(defaultDCFInputs.enterprise_value);
    setFormPrice(defaultDCFInputs.current_price);
  }

  // ── Import from DCF model (one-click save with optional label/notes) ──
  async function importFromModel() {
    if (!currentDCF || saving) return;
    setSaving(true);
    try {
      await projectsApi.saveDCFSnapshot(projectId, {
        label: importLabel.trim() || undefined,
        growth: currentDCF.growth,
        margin: currentDCF.margin,
        tax: currentDCF.tax,
        wacc: currentDCF.wacc,
        terminal_g: currentDCF.terminal_g,
        fair_value_per_share: currentDCF.fair_value_per_share ?? undefined,
        enterprise_value: currentDCF.enterprise_value ?? undefined,
        current_price: currentDCF.current_price ?? undefined,
        notes: importNotes.trim() || undefined,
      });
      setShowImportForm(false);
      setImportLabel("");
      setImportNotes("");
      onDCFImported?.();
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  // ── Manual entry save ─────────────────────────────────────────────────
  async function saveManualSnapshot() {
    if (saving) return;
    const growth = parseFloat(formGrowth);
    const margin = parseFloat(formMargin);
    const tax = parseFloat(formTax);
    const wacc = parseFloat(formWacc);
    const terminal_g = parseFloat(formTermG);
    if ([growth, margin, tax, wacc, terminal_g].some(isNaN)) return;

    setSaving(true);
    try {
      const fv = parseFloat(formFV);
      const ev = parseFloat(formEV);
      const price = parseFloat(formPrice);
      await projectsApi.saveDCFSnapshot(projectId, {
        label: label.trim() || undefined,
        growth: growth / 100,
        margin: margin / 100,
        tax: tax / 100,
        wacc: wacc / 100,
        terminal_g: terminal_g / 100,
        fair_value_per_share: isNaN(fv) ? undefined : fv,
        enterprise_value: isNaN(ev) ? undefined : ev,
        current_price: isNaN(price) ? undefined : price,
        notes: notes.trim() || undefined,
      });
      setShowManualAdd(false);
      resetManualForm();
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSnapshot(id: number) {
    await projectsApi.deleteDCFSnapshot(projectId, id);
    setConfirmDelete(null);
    setExpanded(null);
    onUpdate();
  }

  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const fmtPx = (v: number | null) => (v != null ? `$${v.toFixed(2)}` : "—");

  const pctFieldStyle: React.CSSProperties = {
    ...inputStyle,
    width: 64,
    fontFamily: "monospace",
    textAlign: "right",
  };

  const dollarFieldStyle: React.CSSProperties = {
    ...inputStyle,
    width: 90,
    fontFamily: "monospace",
    textAlign: "right",
  };

  const hasDCF = !!currentDCF;

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <span>📐 DCF Versions</span>
        <div style={{ display: "flex", gap: 6 }}>
          {!showManualAdd && !showImportForm && (
            <button
              onClick={() => setShowManualAdd(true)}
              style={{ ...smallBtnStyle, fontSize: 11 }}
            >
              ✎ Manual
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Import-from-model banner — shown when currentDCF is available
          ═══════════════════════════════════════════════════════════════════ */}
      {hasDCF && !showManualAdd && (
        <div
          style={{
            padding: 14,
            background: "linear-gradient(135deg, #1a1028 0%, #151520 100%)",
            border: "1px solid #a855f730",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#a855f7", fontWeight: 600 }}>
              📸 Import from DCF Model
            </div>
            <button
              onClick={() => onOpenDCF(ticker)}
              style={{
                background: "none",
                border: "1px solid #333",
                borderRadius: 4,
                color: "#888",
                fontSize: 10,
                padding: "3px 8px",
                cursor: "pointer",
              }}
            >
              ↻ Adjust Sliders
            </button>
          </div>

          {/* Current values preview */}
          <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "Growth", value: fmtPct(currentDCF!.growth) },
              { label: "Margin", value: fmtPct(currentDCF!.margin) },
              { label: "Tax", value: fmtPct(currentDCF!.tax) },
              { label: "WACC", value: fmtPct(currentDCF!.wacc) },
              { label: "Term G", value: fmtPct(currentDCF!.terminal_g) },
            ].map((f) => (
              <div key={f.label} style={{ minWidth: 50 }}>
                <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.label}</div>
                <div style={{ fontSize: 13, fontFamily: "monospace", color: "#ccc" }}>{f.value}</div>
              </div>
            ))}
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fair Value</div>
              <div style={{ fontSize: 16, fontFamily: "monospace", color: "#a855f7", fontWeight: 700 }}>
                {fmtPx(currentDCF!.fair_value_per_share)}
              </div>
            </div>
          </div>

          {/* Import actions */}
          {showImportForm ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                autoFocus
                placeholder="Label (e.g. Base Case)"
                value={importLabel}
                onChange={(e) => setImportLabel(e.target.value)}
                style={{ ...inputStyle, width: 160 }}
              />
              <input
                placeholder="Notes — what assumptions changed…"
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && importFromModel()}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={importFromModel}
                disabled={saving}
                style={{
                  ...smallBtnStyle,
                  background: "#a855f730",
                  border: "1px solid #a855f760",
                  color: "#a855f7",
                  fontWeight: 600,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setShowImportForm(false); setImportLabel(""); setImportNotes(""); }}
                style={{ ...smallBtnStyle, color: "#666" }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setShowImportForm(true)}
                style={{
                  flex: 1,
                  background: "#a855f720",
                  border: "1px solid #a855f740",
                  borderRadius: 6,
                  color: "#a855f7",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                ↓ Import as Snapshot
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          "Open DCF Model" CTA — shown when no currentDCF, no snapshots
          ═══════════════════════════════════════════════════════════════════ */}
      {!hasDCF && snapshots.length === 0 && !showManualAdd && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "24px 16px",
            background: "#151515",
            border: "1px dashed #333",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 24, opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: 13, color: "#888", textAlign: "center", maxWidth: 320 }}>
            Open the DCF model to set your valuation assumptions with interactive sliders, then import the result here.
          </div>
          <button
            onClick={() => onOpenDCF(ticker)}
            style={{
              background: "#a855f720",
              border: "1px solid #a855f740",
              borderRadius: 8,
              color: "#a855f7",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 24px",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Open DCF Model →
          </button>
          <div style={{ fontSize: 11, color: "#555" }}>
            or{" "}
            <span
              onClick={() => setShowManualAdd(true)}
              style={{ color: "#666", cursor: "pointer", textDecoration: "underline" }}
            >
              enter values manually
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          "Open DCF Model" inline button — when snapshots exist but no DCF
          ═══════════════════════════════════════════════════════════════════ */}
      {!hasDCF && snapshots.length > 0 && !showManualAdd && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => onOpenDCF(ticker)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 16px",
              background: "#151520",
              border: "1px dashed #a855f730",
              borderRadius: 8,
              color: "#a855f7",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📊 Open DCF Model to create new snapshot →
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Manual add form
          ═══════════════════════════════════════════════════════════════════ */}
      {showManualAdd && (
        <div
          style={{
            padding: 14,
            background: "#151515",
            border: "1px solid #333",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>Manual Entry</span>
            {!hasDCF && (
              <button
                onClick={() => { setShowManualAdd(false); onOpenDCF(ticker); }}
                style={{
                  background: "none",
                  border: "1px solid #a855f730",
                  borderRadius: 4,
                  color: "#a855f7",
                  fontSize: 10,
                  padding: "3px 8px",
                  cursor: "pointer",
                }}
              >
                📊 Use DCF Model instead
              </button>
            )}
          </div>

          {/* Row 1: Label + Notes */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              autoFocus
              placeholder="Label (e.g. Base Case)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{ ...inputStyle, width: 180 }}
            />
            <input
              placeholder="Notes — what assumptions changed…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          {/* Row 2: DCF assumptions (percentages) */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "Growth %", value: formGrowth, set: setFormGrowth },
              { label: "Margin %", value: formMargin, set: setFormMargin },
              { label: "Tax %", value: formTax, set: setFormTax },
              { label: "WACC %", value: formWacc, set: setFormWacc },
              { label: "Term G %", value: formTermG, set: setFormTermG },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, color: "#666" }}>{f.label}</span>
                <input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  style={pctFieldStyle}
                />
              </div>
            ))}
          </div>

          {/* Row 3: Dollar values (optional) */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "Fair Value / Share", value: formFV, set: setFormFV },
              { label: "Enterprise Value", value: formEV, set: setFormEV },
              { label: "Current Price", value: formPrice, set: setFormPrice },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, color: "#666" }}>{f.label}</span>
                <input
                  placeholder="$"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  style={dollarFieldStyle}
                />
              </div>
            ))}
          </div>

          {/* Save button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button
              onClick={() => { setShowManualAdd(false); resetManualForm(); }}
              style={{ ...smallBtnStyle, color: "#666" }}
            >
              Cancel
            </button>
            <button
              onClick={saveManualSnapshot}
              disabled={saving || [formGrowth, formMargin, formTax, formWacc, formTermG].some((v) => isNaN(parseFloat(v)))}
              style={{
                ...smallBtnStyle,
                background: "#a855f720",
                border: "1px solid #a855f740",
                color: "#a855f7",
                fontWeight: 600,
                opacity: [formGrowth, formMargin, formTax, formWacc, formTermG].some((v) => isNaN(parseFloat(v))) ? 0.4 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Snapshot"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Version list
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {snapshots.map((s, i) => {
          const isLatest = i === 0;
          const date = new Date(s.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const isExpanded = expanded === s.id;

          // Diff from previous version
          const prev = i < snapshots.length - 1 ? snapshots[i + 1] : null;
          const fvDiff =
            prev && s.fair_value_per_share != null && prev.fair_value_per_share != null
              ? s.fair_value_per_share - prev.fair_value_per_share
              : null;

          return (
            <div key={s.id}>
              <button
                onClick={() => setExpanded(isExpanded ? null : s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  background: isLatest ? "#1a1a2a" : "#151515",
                  border: `1px solid ${isLatest ? "#3b82f630" : "#222"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888", minWidth: 24 }}>
                  v{s.version}
                </span>
                {isLatest && (
                  <span style={{ fontSize: 9, background: "#3b82f630", color: "#3b82f6", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>
                    CURRENT
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: "#a855f7" }}>
                  {fmtPx(s.fair_value_per_share)}
                </span>
                {fvDiff != null && (
                  <span style={{ fontSize: 11, color: fvDiff >= 0 ? "#22c55e" : "#ef4444" }}>
                    ({fvDiff >= 0 ? "+" : ""}{fvDiff.toFixed(2)})
                  </span>
                )}
                <span style={{ flex: 1, fontSize: 12, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.label || s.notes || ""}
                </span>
                <span style={{ fontSize: 11, color: "#555", flexShrink: 0 }}>{date}</span>
              </button>

              {isExpanded && (
                <div
                  style={{
                    padding: "10px 12px",
                    marginTop: -1,
                    background: "#0f0f15",
                    border: "1px solid #2a2a2a",
                    borderTop: "none",
                    borderRadius: "0 0 6px 6px",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ color: "#666", fontSize: 10 }}>Growth</div>
                      <div style={{ fontFamily: "monospace" }}>{fmtPct(s.growth)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#666", fontSize: 10 }}>Margin</div>
                      <div style={{ fontFamily: "monospace" }}>{fmtPct(s.margin)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#666", fontSize: 10 }}>Tax</div>
                      <div style={{ fontFamily: "monospace" }}>{fmtPct(s.tax)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#666", fontSize: 10 }}>WACC</div>
                      <div style={{ fontFamily: "monospace" }}>{fmtPct(s.wacc)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#666", fontSize: 10 }}>Term G</div>
                      <div style={{ fontFamily: "monospace" }}>{fmtPct(s.terminal_g)}</div>
                    </div>
                  </div>
                  {s.enterprise_value != null && (
                    <div style={{ color: "#666", marginBottom: 4 }}>
                      Enterprise value: <span style={{ color: "#fff", fontFamily: "monospace" }}>${Number(s.enterprise_value).toLocaleString()}</span>
                    </div>
                  )}
                  {s.current_price != null && (
                    <div style={{ color: "#666", marginBottom: 4 }}>
                      Stock price at snapshot: <span style={{ color: "#fff" }}>{fmtPx(s.current_price)}</span>
                      {s.fair_value_per_share != null && s.current_price != null && (
                        <span style={{ marginLeft: 8, color: s.fair_value_per_share >= s.current_price ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                          ({((s.fair_value_per_share / s.current_price - 1) * 100).toFixed(1)}% {s.fair_value_per_share >= s.current_price ? "upside" : "downside"})
                        </span>
                      )}
                    </div>
                  )}
                  {s.notes && <div style={{ color: "#bbb", marginTop: 4, marginBottom: 8 }}>"{s.notes}"</div>}

                  {/* Delete button */}
                  <div style={{ borderTop: "1px solid #222", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
                    {confirmDelete === s.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#ef4444" }}>Delete this snapshot?</span>
                        <button
                          onClick={() => deleteSnapshot(s.id)}
                          style={{ ...smallBtnStyle, color: "#ef4444", border: "1px solid #ef444440", background: "#ef444415", fontSize: 11 }}
                        >
                          Yes, delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{ ...smallBtnStyle, color: "#666", fontSize: 11 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function SourcesSection({
  projectId,
  sources,
  onUpdate,
}: {
  projectId: number;
  sources: ProjectSourceItem[];
  onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState<string>("note");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");

  async function addSource() {
    if (!newTitle.trim()) return;
    await projectsApi.addSource(projectId, {
      source_type: newType,
      title: newTitle.trim(),
      url: newUrl.trim() || undefined,
      notes: newNotes.trim() || undefined,
    });
    setNewTitle("");
    setNewUrl("");
    setNewNotes("");
    setShowAdd(false);
    onUpdate();
  }

  async function removeSource(id: number) {
    await projectsApi.deleteSource(projectId, id);
    onUpdate();
  }

  const typeIcon: Record<string, string> = {
    filing: "📄",
    earnings_call: "🎙",
    news: "📰",
    note: "📝",
    other: "🔗",
  };

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <span>🔗 Linked Sources</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ ...smallBtnStyle, fontSize: 11 }}>
          + Link
        </button>
      </div>

      {sources.length === 0 && !showAdd && (
        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
          No linked sources. Attach filings, earnings calls, and news that support your thesis.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sources.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "#151515",
              borderRadius: 6,
              border: "1px solid #222",
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcon[s.source_type] ?? "🔗"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#3b82f6", fontSize: 13, textDecoration: "none" }}
                >
                  {s.title}
                </a>
              ) : (
                <span style={{ fontSize: 13 }}>{s.title}</span>
              )}
              {s.notes && (
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{s.notes}</div>
              )}
            </div>
            <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>
              {new Date(s.linked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <button
              onClick={() => removeSource(s.id)}
              style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: 0 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            background: "#151515",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            >
              <option value="filing">📄 Filing</option>
              <option value="earnings_call">🎙 Earnings Call</option>
              <option value="news">📰 News</option>
              <option value="note">📝 Note</option>
              <option value="other">🔗 Other</option>
            </select>
            <input
              autoFocus
              placeholder="Title / description…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              placeholder="URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              placeholder="Notes (optional)"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSource()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addSource} disabled={!newTitle.trim()} style={smallBtnStyle}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SHARED STYLES (match existing dark theme exactly)
// ═══════════════════════════════════════════════════════════════════════════════

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 10,
  padding: 16,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  background: "#222",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#fff",
  padding: "5px 8px",
  fontSize: 12,
  outline: "none",
};

const smallBtnStyle: React.CSSProperties = {
  background: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#ccc",
  fontSize: 12,
  padding: "5px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function badgeBtn(color: string): React.CSSProperties {
  return {
    background: `${color}15`,
    border: `1px solid ${color}40`,
    borderRadius: 4,
    color: color,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.5px",
    padding: "3px 8px",
    cursor: "pointer",
  };
}

function badgeSelect(color: string): React.CSSProperties {
  return {
    backgroundColor: `${color}15`,   // ← was `background`
    border: `1px solid ${color}40`,
    borderRadius: 4,
    color: color,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.5px",
    padding: "3px 8px",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    paddingRight: 18,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 6px center",
  };
}