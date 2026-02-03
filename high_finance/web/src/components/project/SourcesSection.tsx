import { useState } from "react";
import { projectsApi } from "./api";
import type { ProjectSourceItem } from "./types";
import { cardStyle, sectionHeader, inputStyle, smallBtnStyle } from "./sharedStyles";

interface SourcesSectionProps {
  projectId: number;
  sources: ProjectSourceItem[];
  onUpdate: () => void;
}

export function SourcesSection({ projectId, sources, onUpdate }: SourcesSectionProps) {
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
