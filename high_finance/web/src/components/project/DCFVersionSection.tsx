import { useState } from "react";
import { projectsApi } from "./api";
import type { DCFSnapshot, ProjectWorkspaceProps } from "./types";
import { cardStyle, sectionHeader, inputStyle, smallBtnStyle } from "./sharedStyles";

interface DCFVersionsSectionProps {
  projectId: number;
  ticker: string;
  snapshots: DCFSnapshot[];
  currentDCF?: ProjectWorkspaceProps["currentDCF"];
  onUpdate: () => void;
  onOpenDCF: (ticker: string) => void;
  onDCFImported?: () => void;
}

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

export function DCFVersionsSection({
  projectId,
  ticker,
  snapshots,
  currentDCF,
  onUpdate,
  onOpenDCF,
  onDCFImported,
}: DCFVersionsSectionProps) {
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Import-from-model state
  const [showImportForm, setShowImportForm] = useState(false);
  const [importLabel, setImportLabel] = useState("");
  const [importNotes, setImportNotes] = useState("");

  // Manual form fields
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

      {/* Import-from-model banner */}
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

      {/* "Open DCF Model" CTA — when no currentDCF, no snapshots */}
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

      {/* "Open DCF Model" inline button — when snapshots exist but no DCF */}
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

      {/* Manual add form */}
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

      {/* Version list */}
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
