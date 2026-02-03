import { useState } from "react";
import { projectsApi } from "./api";
import type { ThesisBullet } from "./types";
import { cardStyle, sectionHeader, inputStyle, smallBtnStyle } from "./sharedStyles";

interface ThesisSectionProps {
  projectId: number;
  bullets: ThesisBullet[];
  onUpdate: () => void;
}

export function ThesisSection({ projectId, bullets, onUpdate }: ThesisSectionProps) {
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
