import { useState } from "react";
import { projectsApi } from "./api";
import type { Catalyst, CatalystStatus } from "./types";
import { cardStyle, sectionHeader, inputStyle, smallBtnStyle } from "./sharedStyles";

interface CatalystsSectionProps {
  projectId: number;
  catalysts: Catalyst[];
  onUpdate: () => void;
}

export function CatalystsSection({ projectId, catalysts, onUpdate }: CatalystsSectionProps) {
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
