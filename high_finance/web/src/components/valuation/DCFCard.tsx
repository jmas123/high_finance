import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ValuationBundle, Warning, SliderReference, AISuggestion } from "../../lib/types";
import { MultiplesTable } from "./MultiplesTable";
import { FairValueRangeBar } from "./FairValueRangeBar";
import { TornadoChart } from "./TornadoChart";
import { SliderWithReferences } from "./SliderWithReference";
import { Metric } from "./Metric";
import { ScenarioCard } from "./ScenarioCard";
import { WarningBadge } from "./Warnings";
import { DivergenceExplainer } from "./DivergenceExplainer";
import { AISuggestionPanel } from "./AISuggestionPanel";
import { fmtMoney, fmtPct, fmtPctSigned, fmtPx } from "../Functions";
import { api, fetchWithTimeout, getAuthHeaders } from "../../lib/api";
import { InfoTip } from "../common/InfoTip";
import { VALUATION_TIPS } from "../../lib/tooltips";

// ── constants ────────────────────────────────────────────────────────────────
const VALUATION_BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";

// ── localStorage persistence for DCF inputs ──────────────────────────────────
const DCF_STORAGE_KEY = "hf_dcf_inputs";

type SavedDCFInputs = {
  growth: number;
  margin: number;
  tax: number;
  wacc: number;
  terminal_g: number;
  savedAt: string;
};

function loadSavedInputs(ticker: string): SavedDCFInputs | null {
  try {
    const stored = localStorage.getItem(DCF_STORAGE_KEY);
    if (!stored) return null;
    const all = JSON.parse(stored) as Record<string, SavedDCFInputs>;
    return all[ticker.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

function saveInputs(ticker: string, inputs: Omit<SavedDCFInputs, "savedAt">) {
  try {
    const stored = localStorage.getItem(DCF_STORAGE_KEY);
    const all = stored ? JSON.parse(stored) : {};
    all[ticker.toUpperCase()] = { ...inputs, savedAt: new Date().toISOString() };
    localStorage.setItem(DCF_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

// ── Callback shape for project DCF snapshot wiring ───────────────────────────
type DCFStateReport = {
  growth: number;
  margin: number;
  tax: number;
  wacc: number;
  terminal_g: number;
  fair_value_per_share: number | null;
  enterprise_value: number | null;
  current_price: number | null;
};

interface DCFCardProps {
  ticker: string;
  /** Optional callback – reports current DCF state to parent (for Research Projects snapshot) */
  onStateChange?: (state: DCFStateReport | null) => void;
  /** Initial data from bundle - used if no saved inputs in localStorage */
  initialData?: ValuationBundle | null;
}

export function DCFCard({ ticker, onStateChange, initialData }: DCFCardProps) {
  const [growth, setGrowth] = useState<number | null>(null);
  const [margin, setMargin] = useState<number | null>(null);
  const [tax, setTax] = useState<number | null>(null);
  const [wacc, setWacc] = useState<number | null>(null);
  const [terminalG, setTerminalG] = useState<number | null>(null);

  const [data, setData] = useState<ValuationBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [skipNextUpdate, setSkipNextUpdate] = useState(false); // Prevents double-fetch after init
  const fetchingRef = useRef<string | null>(null); // Prevents StrictMode double-fetch

  const [activeTab, setActiveTab] = useState<"dcf" | "multiples" | "sensitivity">("dcf");

  // Memoize chart data so TornadoChart (React.memo) doesn't re-render on unrelated state changes
  const sensitivityData = useMemo(() => data?.sensitivity?.sensitivities ?? [], [data?.sensitivity?.sensitivities]);
  const baseFV = useMemo(() => data?.sensitivity?.base_fair_value ?? 0, [data?.sensitivity?.base_fair_value]);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [preAiValues, setPreAiValues] = useState<{
    growth: number; margin: number; tax: number; wacc: number; terminal_g: number;
  } | null>(null);

  // ── Capture market-implied assumptions when divergence first detected ──────
  // This prevents the "oscillation bug" where clicking "Use Market Implied"
  // causes divergence to flip, and clicking again reverts to original values
  const [capturedImplied, setCapturedImplied] = useState<{
    implied_growth: number | null;
    implied_margin: number | null;
    implied_wacc: number | null;
  } | null>(null);

  // ── Store user's original values before applying market-implied ──────────
  // This allows "Keep My Assumptions" to properly restore user's values
  const [preMarketValues, setPreMarketValues] = useState<{
    growth: number;
    margin: number;
    wacc: number;
  } | null>(null);

  // ── Report state to parent when data or inputs change ──────────────────────
  useEffect(() => {
    if (!onStateChange) return;
    if (!data || !initialized || growth === null) {
      onStateChange(null);
      return;
    }
    onStateChange({
      growth: growth!,
      margin: margin!,
      tax: tax!,
      wacc: wacc!,
      terminal_g: terminalG!,
      fair_value_per_share: data.fair_value_per_share_est ?? null,
      enterprise_value: data.dcf?.enterprise_value ?? null,
      current_price: data.facts?.current_price ?? null,
    });
  }, [data, growth, margin, tax, wacc, terminalG, initialized]);

  // Initial load - check localStorage first, then fall back to bundle or smart defaults
  useEffect(() => {
    if (!ticker) return;

    // Prevent StrictMode double-fetch
    if (fetchingRef.current === ticker) return;
    fetchingRef.current = ticker;

    const controller = new AbortController();
    let mounted = true;
    async function loadInitial() {
      setLoading(true);
      setErr(null);
      setInitialized(false);

      // Check for saved inputs in localStorage
      const saved = loadSavedInputs(ticker);

      try {
        let json: ValuationBundle;

        // If we have saved inputs, need to refetch with those params
        if (saved) {
          const q = new URLSearchParams({
            growth: String(saved.growth),
            margin: String(saved.margin),
            tax: String(saved.tax),
            wacc: String(saved.wacc),
            terminal_g: String(saved.terminal_g),
          });
          const res = await fetchWithTimeout(
            `${VALUATION_BASE}/valuation/${encodeURIComponent(ticker)}?${q.toString()}`,
            { signal: controller.signal, headers: getAuthHeaders() },
          );
          if (!res.ok) throw new Error(await res.text());
          json = (await res.json()) as ValuationBundle;
        } else if (initialData) {
          // Use bundle data if available and no saved inputs
          json = initialData;
        } else {
          // Fetch with smart defaults
          const res = await fetchWithTimeout(
            `${VALUATION_BASE}/valuation/${encodeURIComponent(ticker)}`,
            { signal: controller.signal, headers: getAuthHeaders() },
          );
          if (!res.ok) throw new Error(await res.text());
          json = (await res.json()) as ValuationBundle;
        }

        if (mounted) {
          setData(json);
          // Error response (e.g. no revenue data) — show error, skip slider init
          if (json.error) {
            setInitialized(true);
            setSkipNextUpdate(true);
          } else if (saved) {
            // Use saved inputs if available
            setGrowth(saved.growth);
            setMargin(saved.margin);
            setTax(saved.tax);
            setWacc(saved.wacc);
            setTerminalG(saved.terminal_g);
            setLastSaved(new Date(saved.savedAt));
            setInitialized(true);
            setSkipNextUpdate(true);
          } else {
            // Use smart defaults from API
            setGrowth(json.inputs.growth);
            setMargin(json.inputs.margin);
            setTax(json.inputs.tax);
            setWacc(json.inputs.wacc);
            setTerminalG(json.inputs.terminal_g);
            setLastSaved(new Date());
            setInitialized(true);
            setSkipNextUpdate(true);
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return; // Cancelled — don't set error
        if (mounted) setErr(e?.message ?? "Failed to load valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadInitial();
    return () => { mounted = false; controller.abort(); fetchingRef.current = null; };
  }, [ticker, initialData]);

  // Subsequent updates when sliders change - also saves to localStorage
  useEffect(() => {
    if (!ticker || !initialized || growth === null) return;

    // Skip the first run after initialization (we just loaded data)
    if (skipNextUpdate) {
      setSkipNextUpdate(false);
      return;
    }

    const controller = new AbortController();
    let mounted = true;
    async function update() {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          growth: String(growth),
          margin: String(margin),
          tax: String(tax),
          wacc: String(wacc),
          terminal_g: String(terminalG),
        });
        const res = await fetchWithTimeout(
          `${VALUATION_BASE}/valuation/${encodeURIComponent(ticker)}?${q.toString()}`,
          { signal: controller.signal, headers: getAuthHeaders() },
        );
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ValuationBundle;
        if (mounted) {
          setData(json);
          setErr(null); // Clear any previous error on success
          setLastSaved(new Date());
          // Persist inputs to localStorage
          saveInputs(ticker, {
            growth: growth!,
            margin: margin!,
            tax: tax!,
            wacc: wacc!,
            terminal_g: terminalG!,
          });
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return; // Cancelled by new slider change — don't set error
        if (mounted) setErr(e?.message ?? "Failed to update valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timer = setTimeout(update, 500); // Debounce (500ms to reduce fetch pile-up)
    return () => { mounted = false; clearTimeout(timer); controller.abort(); };
  }, [ticker, growth, margin, tax, wacc, terminalG, initialized]);

  // Capture market-implied assumptions when divergence first detected
  // Only capture once per ticker - this prevents oscillation when user clicks the button
  useEffect(() => {
    const divergence = data?.divergence_analysis;
    if (
      divergence &&
      divergence.divergence_tier !== "normal" &&
      divergence.implied_assumptions &&
      !capturedImplied
    ) {
      setCapturedImplied({
        implied_growth: divergence.implied_assumptions.implied_growth,
        implied_margin: divergence.implied_assumptions.implied_margin,
        implied_wacc: divergence.implied_assumptions.implied_wacc,
      });
    }
  }, [data?.divergence_analysis, capturedImplied]);

  // Reset captured implied and AI state when ticker changes
  useEffect(() => {
    setCapturedImplied(null);
    setAiSuggestion(null);
    setPreAiValues(null);
    setAiError(null);
  }, [ticker]);

  // Build slider references from smart defaults
  const sliderRefs = useMemo(() => {
    if (!data?.smart_defaults) return {};
    const sd = data.smart_defaults;
    
    return {
      growth: [
        sd.growth.historical_3y != null && { value: sd.growth.historical_3y, label: "3Y hist", color: "#60a5fa" },
        sd.growth.analyst_estimate != null && { value: sd.growth.analyst_estimate, label: "Analyst", color: "#a855f7" },
        { value: sd.growth.sector_median, label: "Sector", color: "#888" },
      ].filter(Boolean) as SliderReference[],
      margin: [
        sd.margin.current != null && { value: sd.margin.current, label: "Current", color: "#60a5fa" },
        sd.margin.historical_avg != null && { value: sd.margin.historical_avg, label: "Avg", color: "#888" },
        { value: sd.margin.sector_median, label: "Sector", color: "#888" },
      ].filter(Boolean) as SliderReference[],
      wacc: [
        sd.wacc.beta_implied != null && { value: sd.wacc.beta_implied, label: `CAPM (β=${sd.wacc.beta?.toFixed(1)})`, color: "#60a5fa" },
      ].filter(Boolean) as SliderReference[],
      tax: [
        sd.tax.effective_rate != null && { value: sd.tax.effective_rate, label: "Effective", color: "#60a5fa" },
        { value: 0.21, label: "US Corp", color: "#888" },
      ].filter(Boolean) as SliderReference[],
      terminal_g: [
        { value: 0.025, label: "GDP", color: "#888" },
      ] as SliderReference[],
    };
  }, [data?.smart_defaults]);

  // Group warnings by param
  const warningsByParam = useMemo(() => {
    if (!data?.warnings) return {};
    const map: Record<string, Warning[]> = {};
    for (const w of data.warnings) {
      if (!map[w.param]) map[w.param] = [];
      map[w.param].push(w as Warning);
    }
    return map;
  }, [data?.warnings]);

  // Handler for "Use Market Assumptions" button
  // Uses CAPTURED implied values (from first detection) to prevent oscillation bug
  const handleUseMarketAssumptions = useCallback(() => {
    if (!capturedImplied || growth === null || margin === null || wacc === null) return;

    // Save current values so user can revert with "Keep My Assumptions"
    setPreMarketValues({ growth, margin, wacc });

    if (capturedImplied.implied_growth !== null) {
      const g = Math.min(0.50, Math.max(-0.10, capturedImplied.implied_growth));
      setGrowth(g);
    }
    if (capturedImplied.implied_margin !== null) {
      const m = Math.min(0.50, Math.max(-0.10, capturedImplied.implied_margin));
      setMargin(m);
    }
    if (capturedImplied.implied_wacc !== null) {
      // Floor at 8% (assumes ~4% risk-free + 4% minimum equity risk premium)
      const w = Math.min(0.20, Math.max(0.08, capturedImplied.implied_wacc));
      setWacc(w);
    }
  }, [capturedImplied, growth, margin, wacc]);

  // Handler for "Keep My Assumptions" button - restores values from before market-implied was applied
  const handleKeepMyAssumptions = useCallback(() => {
    if (preMarketValues) {
      setGrowth(preMarketValues.growth);
      setMargin(preMarketValues.margin);
      setWacc(preMarketValues.wacc);
      setPreMarketValues(null);
    }
  }, [preMarketValues]);

  // Handler to reset to smart defaults (clears localStorage)
  const handleResetToDefaults = useCallback(() => {
    if (!data?.smart_defaults) return;
    // Clear from localStorage
    try {
      const stored = localStorage.getItem(DCF_STORAGE_KEY);
      if (stored) {
        const all = JSON.parse(stored);
        delete all[ticker.toUpperCase()];
        localStorage.setItem(DCF_STORAGE_KEY, JSON.stringify(all));
      }
    } catch {}
    // Reset sliders to smart defaults from current data
    if (data.inputs) {
      setGrowth(data.inputs.growth);
      setMargin(data.inputs.margin);
      setTax(data.inputs.tax);
      setWacc(data.inputs.wacc);
      setTerminalG(data.inputs.terminal_g);
    }
  }, [ticker, data]);

  // Handler to export to Excel
  const handleExportToExcel = useCallback(async () => {
    if (!ticker || growth === null) return;

    setExporting(true);
    setExportError(null);

    try {
      const blob = await api.exportTickerToExcel(ticker, {
        growth: growth!,
        margin: margin!,
        wacc: wacc!,
        tax: tax!,
        terminal_g: terminalG!,
      });

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
  }, [ticker, growth, margin, wacc, tax, terminalG]);

  // AI Suggest handler
  const handleAISuggest = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const suggestion = await api.valuationAISuggest(ticker);
      setAiSuggestion(suggestion);
    } catch (e: any) {
      setAiError(e?.message || "AI suggestion failed");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
    }
  }, [ticker]);

  // Apply AI suggestions to sliders
  const handleApplyAISuggestion = useCallback(() => {
    if (!aiSuggestion || growth === null) return;
    setPreAiValues({ growth: growth!, margin: margin!, tax: tax!, wacc: wacc!, terminal_g: terminalG! });
    if (aiSuggestion.growth.value != null) setGrowth(aiSuggestion.growth.value);
    if (aiSuggestion.margin.value != null) setMargin(aiSuggestion.margin.value);
    if (aiSuggestion.tax.value != null) setTax(aiSuggestion.tax.value);
    if (aiSuggestion.wacc.value != null) setWacc(aiSuggestion.wacc.value);
    if (aiSuggestion.terminal_g.value != null) setTerminalG(aiSuggestion.terminal_g.value);
  }, [aiSuggestion, growth, margin, tax, wacc, terminalG]);

  // Restore pre-AI values
  const handleRestorePreAi = useCallback(() => {
    if (!preAiValues) return;
    setGrowth(preAiValues.growth);
    setMargin(preAiValues.margin);
    setTax(preAiValues.tax);
    setWacc(preAiValues.wacc);
    setTerminalG(preAiValues.terminal_g);
    setPreAiValues(null);
  }, [preAiValues]);

  // Check if current values differ from smart defaults
  const hasCustomValues = useMemo(() => {
    if (!data?.smart_defaults || growth === null) return false;
    const sd = data.smart_defaults;
    const defaultGrowth = sd.growth.analyst_estimate ?? sd.growth.historical_3y ?? sd.growth.sector_median;
    const defaultMargin = sd.margin.current ?? sd.margin.historical_avg ?? sd.margin.sector_median;
    const defaultWacc = sd.wacc.beta_implied ?? 0.10;
    const defaultTax = sd.tax.effective_rate ?? 0.21;
    const defaultTerminalG = 0.025;

    return (
      Math.abs(growth - defaultGrowth) > 0.001 ||
      Math.abs(margin! - defaultMargin) > 0.001 ||
      Math.abs(wacc! - defaultWacc) > 0.001 ||
      Math.abs(tax! - defaultTax) > 0.001 ||
      Math.abs(terminalG! - defaultTerminalG) > 0.001
    );
  }, [data?.smart_defaults, growth, margin, wacc, tax, terminalG]);

  const upside = data?.upside_downside;
  const fvRange = data?.fair_value_range;
  const analyst = data?.analyst_consensus;

  if (!initialized && !loading && !err) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: 40, textAlign: "center", opacity: 0.5 }}>
        Loading valuation model...
      </div>
    );
  }

  return (
    <div style={{ 
      background: "linear-gradient(145deg, #1a1a1a 0%, #141414 100%)", 
      border: "1px solid #2a2a2a", 
      borderRadius: 14, 
      padding: 20,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header row — title + status (left) | fair value (right) */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>Valuation Engine</span>
            {loading ? (
              <span style={{
                fontSize: 11,
                color: "#f59e0b",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "2px 8px",
                borderRadius: 4,
              }}>
                Calculating...
              </span>
            ) : lastSaved ? (
              <span style={{
                fontSize: 11,
                color: "#22c55e",
                background: "rgba(34, 197, 94, 0.1)",
                padding: "2px 8px",
                borderRadius: 4,
              }}>
                Saved {lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5 }}>
            {data?.benchmarks?.sector && <span>{data.benchmarks.sector} • </span>}
            DCF + Multiples + Sensitivity
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center" }}>DCF Fair Value<InfoTip text={VALUATION_TIPS.dcf_fair_value} /></div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 2, letterSpacing: "-1px" }}>
            {data?.fair_value_per_share_est ? fmtPx(data.fair_value_per_share_est) : "—"}
          </div>
          {upside && (
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: upside.upside_pct >= 0 ? "#22c55e" : "#ef4444" }}>
              {fmtPctSigned(upside.upside_pct)} vs {fmtPx(upside.current_price)}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons — separate row below header */}
      {initialized && !loading && (
        <div style={{
          display: "flex",
          gap: 8,
          marginTop: 12,
          flexWrap: "wrap",
        }}>
          {hasCustomValues && (
            <button
              onClick={handleResetToDefaults}
              style={{
                fontSize: 11,
                color: "#aaa",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "5px 12px",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleExportToExcel}
            disabled={exporting}
            style={{
              fontSize: 11,
              color: exporting ? "#555" : "#3b82f6",
              background: exporting ? "transparent" : "rgba(59, 130, 246, 0.08)",
              border: `1px solid ${exporting ? "#333" : "rgba(59, 130, 246, 0.3)"}`,
              borderRadius: 6,
              padding: "5px 12px",
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
          <button
            onClick={handleAISuggest}
            disabled={aiLoading}
            style={{
              fontSize: 11,
              color: aiLoading ? "#555" : "#f59e0b",
              background: aiLoading ? "transparent" : "rgba(245, 158, 11, 0.08)",
              border: `1px solid ${aiLoading ? "#333" : "rgba(245, 158, 11, 0.3)"}`,
              borderRadius: 6,
              padding: "5px 12px",
              cursor: aiLoading ? "not-allowed" : "pointer",
            }}
          >
            {aiLoading ? "Analyzing..." : "AI Suggest"}
          </button>
        </div>
      )}

      {/* Analyst consensus badge */}
      {analyst?.target_mean && (
        <div style={{
          marginTop: 12,
          padding: "8px 12px",
          background: "rgba(168, 85, 247, 0.1)",
          border: "1px solid rgba(168, 85, 247, 0.25)",
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
        }}>
          <div>
            <span style={{ opacity: 0.7, display: "inline-flex", alignItems: "center" }}>Street Consensus<InfoTip text={VALUATION_TIPS.street_consensus} />: </span>
            <span style={{ fontWeight: 600, color: "#a855f7" }}>{fmtPx(analyst.target_mean)}</span>
            {analyst.target_low && analyst.target_high && (
              <span style={{ opacity: 0.5, marginLeft: 8 }}>
                ({fmtPx(analyst.target_low)} – {fmtPx(analyst.target_high)})
              </span>
            )}
          </div>
          <div style={{ opacity: 0.7 }}>
            {analyst.num_analysts} analysts • {analyst.recommendation?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Divergence Explainer - shows when DCF differs significantly from market */}
      {!loading && data?.divergence_analysis &&
       data.divergence_analysis.divergence_tier !== "normal" &&
       data.fair_value_per_share_est !== null &&
       data.facts?.current_price && (
        <DivergenceExplainer
          divergence={data.divergence_analysis}
          currentInputs={data.inputs}
          currentPrice={data.facts.current_price}
          fairValue={data.fair_value_per_share_est}
          onUseMarketAssumptions={handleUseMarketAssumptions}
          onKeepMyAssumptions={handleKeepMyAssumptions}
          hasPreMarketValues={preMarketValues !== null}
        />
      )}

      {/* AI Suggestion Panel */}
      {aiSuggestion && !aiLoading && (
        <AISuggestionPanel
          suggestion={aiSuggestion}
          currentValues={{ growth: growth!, margin: margin!, tax: tax!, wacc: wacc!, terminal_g: terminalG! }}
          onApply={handleApplyAISuggestion}
          onDismiss={() => { setAiSuggestion(null); setPreAiValues(null); }}
          hasApplied={preAiValues !== null}
          onRestore={handleRestorePreAi}
        />
      )}

      {/* AI Error */}
      {aiError && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(245, 158, 11, 0.3)", background: "rgba(245, 158, 11, 0.1)", fontSize: 12 }}>
          <b>AI Suggest:</b> {aiError}
        </div>
      )}

      {/* Error */}
      {err && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.1)" }}>
          <b>Error:</b> {err}
        </div>
      )}

      {/* Export Error */}
      {exportError && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(245, 158, 11, 0.3)", background: "rgba(245, 158, 11, 0.1)" }}>
          <b>Export failed:</b> {exportError}
        </div>
      )}

      {loading && <div style={{ marginTop: 14, opacity: 0.6, fontSize: 13 }}>Recomputing…</div>}

      {!loading && data?.error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.1)" }}>
          <b>Valuation unavailable:</b> {data.error}
        </div>
      )}

      {/* Warnings */}
      {data?.warnings && data.warnings.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {data.warnings.filter(w => w.severity === "error" || w.severity === "warning").map((w, i) => (
            <WarningBadge key={`${w.param}-${w.severity}-${i}`} warning={w as Warning} />
          ))}
        </div>
      )}

      {/* Fair Value Range */}
      {!loading && fvRange && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 4 }}>
            Fair Value Range (Bear → Bull)
          </div>
          <FairValueRangeBar
            low={fvRange.low}
            mid={fvRange.mid}
            high={fvRange.high}
            current={data?.facts?.current_price ?? null}
            analystTarget={analyst?.target_mean ?? null}
            analystLow={analyst?.target_low ?? null}
            analystHigh={analyst?.target_high ?? null}
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginTop: 16, borderBottom: "1px solid #2a2a2a" }}>
        {(["dcf", "multiples", "sensitivity"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? "#2a2a2a" : "transparent",
              color: activeTab === tab ? "#fff" : "#888",
              border: "none",
              borderRadius: "8px 8px 0 0",
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {tab === "dcf" ? "DCF Model" : tab === "multiples" ? "Multiples" : "Sensitivity"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: 16 }}>
        {activeTab === "dcf" && initialized && growth !== null && (
          <>
            {/* Sliders with references */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              <SliderWithReferences
                label="Revenue Growth (5y CAGR)"
                value={growth}
                setValue={setGrowth}
                min={-0.10}
                max={0.50}
                step={0.01}
                references={sliderRefs.growth || []}
                paramWarnings={warningsByParam.growth || []}
                tooltip="Expected compound annual growth rate over next 5 years. High-growth tech: 15-30%. Mature companies: 3-8%. Hover over markers to see historical and analyst estimates."
              />
              <SliderWithReferences
                label="Operating Margin"
                value={margin!}
                setValue={setMargin}
                min={-0.10}
                max={0.50}
                step={0.01}
                references={sliderRefs.margin || []}
                paramWarnings={warningsByParam.margin || []}
                tooltip="Operating income as % of revenue. Software: 25-40%. Retail: 3-8%. Manufacturing: 10-15%. Expanding margins significantly is rare without structural changes."
              />
              <SliderWithReferences
                label="Tax Rate"
                value={tax!}
                setValue={setTax}
                min={0.10}
                max={0.35}
                step={0.01}
                references={sliderRefs.tax || []}
                paramWarnings={warningsByParam.tax || []}
                tooltip="Effective corporate tax rate. US statutory is 21%. International operations may lower this. Check the company's historical effective rate."
              />
              <SliderWithReferences
                label="WACC (Discount Rate)"
                value={wacc!}
                setValue={setWacc}
                min={0.05}
                max={0.20}
                step={0.005}
                references={sliderRefs.wacc || []}
                paramWarnings={warningsByParam.wacc || []}
                tooltip="Weighted average cost of capital. Lower = less risky = higher valuation. Large-cap stable: 7-9%. Growth stocks: 10-12%. Speculative: 12%+. CAPM estimate uses the stock's beta."
              />
              <SliderWithReferences
                label="Terminal Growth"
                value={terminalG!}
                setValue={setTerminalG}
                min={0.00}
                max={0.04}
                step={0.005}
                references={sliderRefs.terminal_g || []}
                paramWarnings={warningsByParam.terminal_g || []}
                tooltip="Perpetual growth rate after forecast period. Should not exceed long-run GDP growth (~2-3%). Higher values assume company grows faster than the economy forever."
              />
            </div>

            {/* Smart defaults source info */}
            {data?.smart_defaults && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 8, fontSize: 11, opacity: 0.8 }}>
                <span style={{ fontWeight: 600 }}>Defaults: </span>
                Growth from {data.smart_defaults.growth.source} • 
                Margin from {data.smart_defaults.margin.source} • 
                WACC from {data.smart_defaults.wacc.source}
              </div>
            )}

            {/* DCF Metrics */}
            {!loading && data && !data.error && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                <Metric 
                  label="Revenue (LTM)" 
                  value={fmtMoney(data.facts.revenue0)} 
                  tooltip="Last twelve months revenue from the most recent annual filing. This is the starting point for projecting future cash flows."
                />
                <Metric 
                  label="EBITDA" 
                  value={fmtMoney(data.facts.ebitda)} 
                  tooltip="Earnings Before Interest, Taxes, Depreciation & Amortization. Proxy for operating cash flow before capex. Used for EV/EBITDA multiple."
                />
                <Metric 
                  label="Net Debt" 
                  value={fmtMoney(data.facts.net_debt_est)} 
                  tooltip="Total debt minus cash & equivalents. Subtracted from enterprise value to get equity value. Negative = net cash position."
                />
                <Metric 
                  label="Enterprise Value" 
                  value={fmtMoney(data.dcf.enterprise_value)} 
                  hint={`Terminal: ${fmtPct(data.dcf.terminal_pct_of_ev)} of EV`}
                  tooltip="Present value of projected free cash flows + terminal value. High terminal % (>70%) means valuation relies heavily on distant future growth."
                />
              </div>
            )}

            {/* Scenarios */}
            {!loading && data?.scenarios && !("error" in data.scenarios) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 8, display: "flex", alignItems: "center" }}>
                  Scenario Analysis<InfoTip text={VALUATION_TIPS.scenario_analysis} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  {(["bear", "base", "bull"] as const).map(scenario => {
                    const s = data.scenarios[scenario];
                    const color = scenario === "bear" ? "#ef4444" : scenario === "bull" ? "#22c55e" : "#3b82f6";
                    const currentPrice = data.facts.current_price;
                    const upsidePct = currentPrice != null && currentPrice > 0 ? (s.fair_value_per_share - currentPrice) / currentPrice : null;
                    
                    const scenarioDescriptions = {
                      bear: "Conservative case: Lower growth, compressed margins, higher discount rate. What if things go wrong?",
                      base: "Base case: Your current assumptions. Most likely outcome given inputs.",
                      bull: "Optimistic case: Higher growth, margin expansion, lower risk. What if everything goes right?",
                    };
                    
                    return (
                      <ScenarioCard
                        key={scenario}
                        scenario={scenario}
                        fairValue={s.fair_value_per_share}
                        upsidePct={upsidePct}
                        inputs={s.inputs}
                        color={color}
                        description={scenarioDescriptions[scenario]}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "multiples" && (
          <div>
            {data?.multiples ? (
              <MultiplesTable multiples={data.multiples} currentPrice={data.facts.current_price} />
            ) : (
              <div style={{ opacity: 0.5, fontSize: 12 }}>Loading multiples…</div>
            )}
          </div>
        )}

        {activeTab === "sensitivity" && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12, display: "flex", alignItems: "center" }}>Impact of ±3% change in each input on fair value<InfoTip text={VALUATION_TIPS.sensitivity} /></div>
            {sensitivityData.length > 0 ? (
              <TornadoChart sensitivities={sensitivityData} baseFV={baseFV} />
            ) : (
              <div style={{ opacity: 0.5, fontSize: 12 }}>Loading sensitivity…</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, fontSize: 10, opacity: 0.4, textAlign: "center" }}>
        Educational model • Simplified FCFF proxy • Sector multiples are approximations
      </div>
    </div>
  );
}