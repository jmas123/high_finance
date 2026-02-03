import { useCallback, useEffect, useMemo, useState } from "react";
import type { ValuationBundle, Warning, SliderReference, ValuationScenarioInputs } from "../../lib/types";
import { MultiplesTable } from "./MultiplesTable";
import { FairValueRangeBar } from "./FairValueRangeBar";
import { TornadoChart } from "./TornadoChart";
import { SliderWithReferences } from "./SliderWithReference";
import { Metric } from "./Metric";
import { ScenarioCard } from "./ScenarioCard";
import { WarningBadge } from "./Warnings";
import { DivergenceExplainer } from "./DivergenceExplainer";
import { fmtMoney, fmtPct, fmtPctSigned, fmtPx } from "../Functions";

// ── NEW: callback shape for project DCF snapshot wiring ──────────────────────
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
}

export function DCFCard({ ticker, onStateChange }: DCFCardProps) {
  const [growth, setGrowth] = useState<number | null>(null);
  const [margin, setMargin] = useState<number | null>(null);
  const [tax, setTax] = useState<number | null>(null);
  const [wacc, setWacc] = useState<number | null>(null);
  const [terminalG, setTerminalG] = useState<number | null>(null);

  const [data, setData] = useState<ValuationBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState<"dcf" | "multiples" | "sensitivity">("dcf");

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

  // Initial load - let backend compute smart defaults
  useEffect(() => {
    if (!ticker) return;
    
    let mounted = true;
    async function loadInitial() {
      setLoading(true);
      setErr(null);
      setInitialized(false);
      try {
        const res = await fetch(`/api/v1/valuation/${encodeURIComponent(ticker)}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ValuationBundle;
        if (mounted) {
          setData(json);
          // Initialize sliders with smart defaults
          setGrowth(json.inputs.growth);
          setMargin(json.inputs.margin);
          setTax(json.inputs.tax);
          setWacc(json.inputs.wacc);
          setTerminalG(json.inputs.terminal_g);
          setInitialized(true);
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? "Failed to load valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadInitial();
    return () => { mounted = false; };
  }, [ticker]);

  // Subsequent updates when sliders change
  useEffect(() => {
    if (!ticker || !initialized || growth === null) return;
    
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
        const res = await fetch(`/api/v1/valuation/${encodeURIComponent(ticker)}?${q.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ValuationBundle;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? "Failed to update valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    const timer = setTimeout(update, 300); // Debounce
    return () => { mounted = false; clearTimeout(timer); };
  }, [ticker, growth, margin, tax, wacc, terminalG, initialized]);

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
  const handleUseMarketAssumptions = useCallback((assumptions: Partial<ValuationScenarioInputs>) => {
    if (assumptions.growth !== undefined) setGrowth(assumptions.growth);
    if (assumptions.margin !== undefined) setMargin(assumptions.margin);
    if (assumptions.wacc !== undefined) setWacc(assumptions.wacc);
  }, []);

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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>Valuation Engine</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5 }}>
            {data?.benchmarks?.sector && <span>{data.benchmarks.sector} • </span>}
            DCF + Multiples + Sensitivity
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>DCF Fair Value</div>
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
            <span style={{ opacity: 0.7 }}>Street Consensus: </span>
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
        />
      )}

      {/* Error */}
      {err && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.1)" }}>
          <b>Error:</b> {err}
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
            <WarningBadge key={i} warning={w as Warning} />
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
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
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
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
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 8 }}>
                  Scenario Analysis
                  <span style={{ marginLeft: 6, opacity: 0.7, textTransform: "none", letterSpacing: "normal" }}>
                    (hover for details)
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {(["bear", "base", "bull"] as const).map(scenario => {
                    const s = data.scenarios[scenario];
                    const color = scenario === "bear" ? "#ef4444" : scenario === "bull" ? "#22c55e" : "#3b82f6";
                    const currentPrice = data.facts.current_price;
                    const upsidePct = currentPrice ? (s.fair_value_per_share - currentPrice) / currentPrice : null;
                    
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
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>Impact of ±3% change in each input on fair value</div>
            {data?.sensitivity?.sensitivities ? (
              <TornadoChart sensitivities={data.sensitivity.sensitivities} baseFV={data.sensitivity.base_fair_value} />
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