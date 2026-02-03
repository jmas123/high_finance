import { useState } from "react";
import { projectsApi } from "./api";
import type { ProjectRiskItem, RiskSeverity } from "./types";
import { cardStyle, sectionHeader, inputStyle, smallBtnStyle } from "./sharedStyles";

interface RisksSectionProps {
  projectId: number;
  risks: ProjectRiskItem[];
  onUpdate: () => void;
}

export function RisksSection({ projectId, risks, onUpdate }: RisksSectionProps) {
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
