import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { api } from "../../lib/api";
import type { OptionDecaySimulation, IVContext } from "../../lib/types";

// ===== EXPLANATIONS =====
const EXPLANATIONS: Record<string, string> = {
  theta:
    "Theta measures how much an option loses per day from time decay alone. A theta of -0.05 means the option loses $0.05 daily (per share) if nothing else changes.",
  decay_curve:
    "This curve shows the option's theoretical value each day if the stock price stays exactly flat. The steepening at the end shows theta acceleration near expiration.",
  intrinsic:
    "Intrinsic value is what the option would be worth if exercised now. For calls: Stock Price - Strike (if positive). For puts: Strike - Stock Price (if positive).",
  extrinsic:
    "Extrinsic (time) value is the premium above intrinsic value. This is what decays to zero by expiration. Higher IV = more extrinsic value.",
  favors_sellers:
    "When IV is high and/or time is short, options have lots of premium that will decay rapidly. Sellers collect this premium hoping the stock stays flat.",
  favors_buyers:
    "When IV is low and time is long, options are cheaper with more time for a move. Buyers pay less theta drag relative to potential upside.",
  moneyness:
    "ITM = In The Money (has intrinsic value). ATM = At The Money (strike ≈ stock price). OTM = Out of The Money (no intrinsic value, all extrinsic).",
  greeks:
    "Greeks measure option sensitivities. Delta: price sensitivity to stock. Gamma: delta's rate of change. Vega: sensitivity to IV changes.",
  iv:
    "Implied Volatility (IV) represents the market's expectation of future price movement. Higher IV = more expensive options. It's derived from option prices, not calculated directly.",
  iv_percentile:
    "IV Percentile shows where current IV ranks compared to the past year. 80% means IV is higher than 80% of the past year's readings - options are relatively expensive.",
  hv:
    "Historical Volatility (HV) measures actual past price movement. Compare to IV: if IV > HV, options may be overpriced. If IV < HV, they may be cheap.",
  contract_iv:
    "This is the actual IV from the market for this specific contract. Using real contract IV gives the most accurate simulation.",
};

// ===== INFO BUTTON COMPONENT =====
function InfoButton({ term }: { term: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const explanation = EXPLANATIONS[term];

  if (!explanation) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPosition({ top: rect.top - 10, left: rect.left + rect.width / 2 });
          setShow(!show);
        }}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "1px solid #555",
          background: show ? "#3b82f6" : "#333",
          color: show ? "#fff" : "#999",
          fontSize: 9,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 4,
          padding: 0,
        }}
      >
        ?
      </button>
      {show &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 9998 }}
              onClick={() => setShow(false)}
            />
            <div
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                transform: "translate(-50%, -100%)",
                width: 280,
                padding: 12,
                background: "#000",
                border: "2px solid #3b82f6",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.6,
                color: "#fff",
                zIndex: 9999,
                boxShadow: "0 8px 32px rgba(0,0,0,1)",
              }}
            >
              {explanation}
              <div
                style={{
                  position: "absolute",
                  bottom: -8,
                  left: "50%",
                  transform: "translateX(-50%) rotate(45deg)",
                  width: 12,
                  height: 12,
                  background: "#000",
                  borderRight: "2px solid #3b82f6",
                  borderBottom: "2px solid #3b82f6",
                }}
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}

// ===== METRIC BOX =====
function MetricBox({
  label,
  value,
  subValue,
  color,
  infoTerm,
}: {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
  infoTerm?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        padding: "12px 14px",
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 11,
          opacity: 0.6,
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
        }}
      >
        {label}
        {infoTerm && <InfoButton term={infoTerm} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || "#fff" }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{subValue}</div>
      )}
    </div>
  );
}

// ===== CUSTOM TOOLTIP =====
function DecayTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "2px solid #3b82f6",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Day {data.day} ({data.days_remaining}d remaining)
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <div>
          <span style={{ opacity: 0.6 }}>Price: </span>
          <span style={{ fontWeight: 500 }}>${data.price.toFixed(2)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6 }}>Decayed: </span>
          <span style={{ color: "#ef4444", fontWeight: 500 }}>
            -${data.decay_from_start.toFixed(2)} ({data.decay_pct.toFixed(1)}%)
          </span>
        </div>
        <div>
          <span style={{ opacity: 0.6 }}>Theta: </span>
          <span style={{ fontWeight: 500 }}>${data.theta?.toFixed(4) || "—"}/day</span>
        </div>
        <div>
          <span style={{ opacity: 0.6 }}>Extrinsic left: </span>
          <span style={{ fontWeight: 500 }}>${data.extrinsic_remaining?.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ===== IV SELECTOR COMPONENT =====
function IVSelector({
  value,
  onChange,
  ivContext,
  contractIV,
  loading,
}: {
  value: number;
  onChange: (iv: number) => void;
  ivContext: IVContext | null;
  contractIV: number | null;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"contract" | "preset" | "custom">(
    contractIV ? "contract" : "preset"
  );

  // Update mode when contract IV becomes available
  useEffect(() => {
    if (contractIV && mode !== "custom") {
      setMode("contract");
      onChange(contractIV);
    }
  }, [contractIV]);

  const presets = [
    { label: "Low", value: 0.15, desc: "Stable stocks, low uncertainty" },
    { label: "Normal", value: 0.25, desc: "Average market conditions" },
    { label: "Elevated", value: 0.35, desc: "Increased uncertainty" },
    { label: "High", value: 0.50, desc: "High fear/volatility events" },
    { label: "Extreme", value: 0.75, desc: "Crisis levels (rare)" },
  ];

  // Determine IV label for display
  const getIVLabel = (iv: number): { label: string; color: string } => {
    if (iv >= 0.6) return { label: "EXTREME", color: "#dc2626" };
    if (iv >= 0.45) return { label: "HIGH", color: "#f97316" };
    if (iv >= 0.30) return { label: "ELEVATED", color: "#eab308" };
    if (iv >= 0.18) return { label: "NORMAL", color: "#22c55e" };
    return { label: "LOW", color: "#3b82f6" };
  };

  const ivLabel = getIVLabel(value);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        borderRadius: 8,
        padding: 12,
        border: "1px solid #333",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Implied Volatility</span>
          <InfoButton term="iv" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: `${ivLabel.color}22`,
              color: ivLabel.color,
            }}
          >
            {ivLabel.label}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{(value * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {contractIV && (
          <button
            onClick={() => {
              setMode("contract");
              onChange(contractIV);
            }}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${mode === "contract" ? "#22c55e" : "#444"}`,
              background: mode === "contract" ? "#14532d" : "#222",
              color: mode === "contract" ? "#22c55e" : "#888",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✓ Contract IV ({(contractIV * 100).toFixed(0)}%)
          </button>
        )}
        <button
          onClick={() => setMode("preset")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: `1px solid ${mode === "preset" ? "#3b82f6" : "#444"}`,
            background: mode === "preset" ? "#1e3a5f" : "#222",
            color: mode === "preset" ? "#3b82f6" : "#888",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Presets
        </button>
        <button
          onClick={() => setMode("custom")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: `1px solid ${mode === "custom" ? "#a855f7" : "#444"}`,
            background: mode === "custom" ? "#3b1c5a" : "#222",
            color: mode === "custom" ? "#a855f7" : "#888",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Custom
        </button>
      </div>

      {/* Contract IV Info */}
      {mode === "contract" && contractIV && (
        <div
          style={{
            padding: 10,
            background: "rgba(34, 197, 94, 0.1)",
            borderRadius: 6,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>📊</span>
          <div>
            <div style={{ fontWeight: 500, color: "#22c55e" }}>Using Real Market IV</div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>
              This is the actual implied volatility from the option chain for your selected contract.
            </div>
          </div>
        </div>
      )}

      {/* Presets */}
      {mode === "preset" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange(preset.value)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${Math.abs(value - preset.value) < 0.01 ? "#3b82f6" : "#333"}`,
                background: Math.abs(value - preset.value) < 0.01 ? "rgba(59,130,246,0.15)" : "#1a1a1a",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{preset.label}</div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>{preset.desc}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#3b82f6" }}>
                {(preset.value * 100).toFixed(0)}%
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Custom Slider */}
      {mode === "custom" && (
        <div>
          <input
            type="range"
            min={5}
            max={150}
            value={value * 100}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            style={{
              width: "100%",
              height: 8,
              borderRadius: 4,
              appearance: "none",
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value * 100 - 5) / 145) * 100}%, #333 ${((value * 100 - 5) / 145) * 100}%, #333 100%)`,
              cursor: "pointer",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, opacity: 0.5 }}>
            <span>5%</span>
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
          </div>
        </div>
      )}

      {/* IV Context Info */}
      {ivContext && (ivContext.iv_percentile !== null || ivContext.hv_20) && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 6,
            fontSize: 11,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            📈 Stock's IV Context
            <InfoButton term="iv_percentile" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {ivContext.atm_iv && (
              <div>
                <span style={{ opacity: 0.6 }}>ATM IV: </span>
                <span style={{ fontWeight: 500 }}>{(ivContext.atm_iv * 100).toFixed(1)}%</span>
              </div>
            )}
            {ivContext.iv_percentile !== null && (
              <div>
                <span style={{ opacity: 0.6 }}>IV Rank: </span>
                <span
                  style={{
                    fontWeight: 500,
                    color: ivContext.iv_percentile > 70 ? "#ef4444" : ivContext.iv_percentile < 30 ? "#22c55e" : "#fff",
                  }}
                >
                  {ivContext.iv_percentile}%
                </span>
              </div>
            )}
            {ivContext.hv_20 && (
              <div>
                <span style={{ opacity: 0.6 }}>HV (20d): </span>
                <span style={{ fontWeight: 500 }}>{(ivContext.hv_20 * 100).toFixed(1)}%</span>
              </div>
            )}
            {ivContext.iv_low_52w && ivContext.iv_high_52w && (
              <div>
                <span style={{ opacity: 0.6 }}>52w Range: </span>
                <span style={{ fontWeight: 500 }}>
                  {(ivContext.iv_low_52w * 100).toFixed(0)}-{(ivContext.iv_high_52w * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5, textAlign: "center" }}>
          Loading IV data...
        </div>
      )}
    </div>
  );
}

// ===== MAIN COMPONENT =====
export function OptionDecaySimulator({ ticker }: { ticker: string }) {
  // Options chain state
  const [chainLoading, setChainLoading] = useState(false);
  const [chainData, setChainData] = useState<{
    current_price: number | null;
    expirations: string[];
  } | null>(null);

  // IV Context
  const [ivContext, setIVContext] = useState<IVContext | null>(null);
  const [ivLoading, setIVLoading] = useState(false);
  const [contractIV, setContractIV] = useState<number | null>(null);

  // User selections
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [selectedStrike, setSelectedStrike] = useState<number | "">("");
  const [selectedType, setSelectedType] = useState<"call" | "put">("call");
  const [selectedIV, setSelectedIV] = useState<number>(0.30);

  // Simulation state
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<OptionDecaySimulation | null>(null);

  // Load options chain and IV context on mount
  useEffect(() => {
    if (!ticker) return;
    
    setChainLoading(true);
    setIVLoading(true);
    
    // Load options overview
    api.optionsOverview(ticker)
      .then((data) => {
        setChainData({
          current_price: data.current_price,
          expirations: data.expirations || [],
        });
        if (data.expirations?.length > 0) {
          setSelectedExpiry(data.expirations[0]);
        }
        if (data.current_price) {
          const rounded = Math.round(data.current_price / 5) * 5;
          setSelectedStrike(rounded);
        }
      })
      .catch(() => {})
      .finally(() => setChainLoading(false));
    
    // Load IV context
    api.ivContext(ticker)
      .then((ctx) => {
        setIVContext(ctx);
        if (ctx.suggested_iv) {
          setSelectedIV(ctx.suggested_iv);
        }
      })
      .catch(() => {})
      .finally(() => setIVLoading(false));
  }, [ticker]);

  // Fetch contract IV when strike/expiry/type changes
  useEffect(() => {
    if (!ticker || !selectedExpiry || !selectedStrike) {
      setContractIV(null);
      return;
    }

    api.contractIV(ticker, selectedExpiry, Number(selectedStrike), selectedType)
      .then((data) => {
        if (data.iv) {
          setContractIV(data.iv);
          setSelectedIV(data.iv);
        } else {
          setContractIV(null);
        }
      })
      .catch(() => {
        setContractIV(null);
      });
  }, [ticker, selectedExpiry, selectedStrike, selectedType]);

  // Calculate days to expiry
  const daysToExpiry = useMemo(() => {
    if (!selectedExpiry) return 0;
    const expDate = new Date(selectedExpiry + "T16:00:00");
    const now = new Date();
    return Math.max(1, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [selectedExpiry]);

  // Run simulation
  async function runSimulation() {
    if (!chainData?.current_price || !selectedStrike || !selectedExpiry) return;

    setSimLoading(true);
    setSimError(null);

    try {
      const result = await api.optionDecaySimulation(ticker, {
        stock_price: chainData.current_price,
        strike: Number(selectedStrike),
        days_to_expiry: daysToExpiry,
        implied_volatility: selectedIV,
        option_type: selectedType,
      });
      setSimulation(result);
    } catch (e: any) {
      setSimError(e?.message || "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  }

  // Determine favors color
  const favorsColor =
    simulation?.interpretation?.favors === "sellers"
      ? "#ef4444"
      : simulation?.interpretation?.favors === "buyers"
      ? "#22c55e"
      : "#9ca3af";

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
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          📉 Flat-Price Decay Simulator
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
          See how time decay erodes option value when the stock doesn't move
        </div>
      </div>

      {/* Input Controls - Contract Selection */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 12,
          padding: 12,
          background: "rgba(99, 102, 241, 0.05)",
          borderRadius: 8,
          border: "1px solid rgba(99, 102, 241, 0.1)",
        }}
      >
        {/* Expiration */}
        <div>
          <label style={{ fontSize: 11, opacity: 0.6, display: "block", marginBottom: 4 }}>
            Expiration
          </label>
          <select
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
            disabled={chainLoading}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
            }}
          >
            {chainData?.expirations.map((exp) => (
              <option key={exp} value={exp}>
                {exp} ({Math.max(1, Math.ceil((new Date(exp + "T16:00:00").getTime() - Date.now()) / 86400000))}d)
              </option>
            ))}
          </select>
        </div>

        {/* Strike */}
        <div>
          <label style={{ fontSize: 11, opacity: 0.6, display: "block", marginBottom: 4 }}>
            Strike Price
          </label>
          <input
            type="number"
            value={selectedStrike}
            onChange={(e) => setSelectedStrike(e.target.value ? Number(e.target.value) : "")}
            placeholder={`~$${chainData?.current_price?.toFixed(0) || "..."}`}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
            }}
          />
          {chainData?.current_price && (
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
              Stock: ${chainData.current_price.toFixed(2)}
            </div>
          )}
        </div>

        {/* Type */}
        <div>
          <label style={{ fontSize: 11, opacity: 0.6, display: "block", marginBottom: 4 }}>
            Option Type
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setSelectedType("call")}
              style={{
                flex: 1,
                padding: "10px",
                background: selectedType === "call" ? "#14532d" : "#222",
                border: `1px solid ${selectedType === "call" ? "#22c55e" : "#444"}`,
                borderRadius: 6,
                color: selectedType === "call" ? "#22c55e" : "#888",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              CALL
            </button>
            <button
              onClick={() => setSelectedType("put")}
              style={{
                flex: 1,
                padding: "10px",
                background: selectedType === "put" ? "#7f1d1d" : "#222",
                border: `1px solid ${selectedType === "put" ? "#ef4444" : "#444"}`,
                borderRadius: 6,
                color: selectedType === "put" ? "#ef4444" : "#888",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              PUT
            </button>
          </div>
        </div>
      </div>

      {/* IV Selector */}
      <div style={{ marginBottom: 12 }}>
        <IVSelector
          value={selectedIV}
          onChange={setSelectedIV}
          ivContext={ivContext}
          contractIV={contractIV}
          loading={ivLoading}
        />
      </div>

      {/* Run Button */}
      <button
        onClick={runSimulation}
        disabled={simLoading || !selectedStrike || !selectedExpiry}
        style={{
          width: "100%",
          padding: "12px 20px",
          background: simLoading ? "#333" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          cursor: simLoading ? "not-allowed" : "pointer",
          opacity: !selectedStrike || !selectedExpiry ? 0.5 : 1,
          marginBottom: 16,
        }}
      >
        {simLoading ? "⏳ Simulating..." : "▶ Run Decay Simulation"}
      </button>

      {/* Error */}
      {simError && (
        <div
          style={{
            padding: 12,
            background: "#3b1818",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <b>Error:</b> {simError}
        </div>
      )}

      {/* Results */}
      {simulation && (
        <>
          {/* Summary Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <MetricBox
              label="Starting Price"
              value={`$${simulation.decay_summary.initial_price.toFixed(2)}`}
              subValue="per share"
            />
            <MetricBox
              label="Ending Price"
              value={`$${simulation.decay_summary.final_price.toFixed(2)}`}
              subValue="at expiration"
            />
            <MetricBox
              label="Total Decay"
              value={`-$${simulation.decay_summary.total_decay_dollars.toFixed(2)}`}
              subValue={`${simulation.decay_summary.total_decay_pct.toFixed(1)}% lost`}
              color="#ef4444"
            />
            <MetricBox
              label="Daily Theta"
              value={`$${Math.abs(simulation.greeks.theta).toFixed(3)}`}
              subValue="per day (current)"
              color="#f59e0b"
              infoTerm="theta"
            />
            <MetricBox
              label="Moneyness"
              value={simulation.current_values.moneyness}
              subValue={`Intrinsic: $${simulation.current_values.intrinsic_value.toFixed(2)}`}
              infoTerm="moneyness"
            />
          </div>

          {/* Decay Chart */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                opacity: 0.6,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
              }}
            >
              Decay Curve (Flat Stock Price Assumption)
              <InfoButton term="decay_curve" />
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={simulation.decay_curve}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="decayGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#888", fontSize: 11 }}
                    axisLine={{ stroke: "#333" }}
                    tickLine={{ stroke: "#333" }}
                    label={{
                      value: "Days Elapsed",
                      position: "bottom",
                      offset: -5,
                      fill: "#666",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#888", fontSize: 11 }}
                    axisLine={{ stroke: "#333" }}
                    tickLine={{ stroke: "#333" }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    domain={[0, "auto"]}
                    label={{
                      value: "Option Price",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#666",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip content={<DecayTooltip />} />
                  <ReferenceLine
                    y={simulation.current_values.intrinsic_value}
                    stroke="#22c55e"
                    strokeDasharray="4 4"
                    label={{
                      value: "Intrinsic",
                      fill: "#22c55e",
                      fontSize: 10,
                      position: "right",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="transparent"
                    fill="url(#decayGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: "#3b82f6" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Greeks */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              marginBottom: 16,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Delta</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {simulation.greeks.delta.toFixed(3)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Gamma</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {simulation.greeks.gamma.toFixed(4)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Theta</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>
                {simulation.greeks.theta.toFixed(4)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Vega</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {simulation.greeks.vega.toFixed(3)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Rho</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {simulation.greeks.rho.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Interpretation */}
          {simulation.interpretation && (
            <div
              style={{
                padding: 14,
                background:
                  simulation.interpretation.favors === "sellers"
                    ? "rgba(239, 68, 68, 0.1)"
                    : simulation.interpretation.favors === "buyers"
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${favorsColor}33`,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: `${favorsColor}22`,
                    color: favorsColor,
                    textTransform: "uppercase",
                  }}
                >
                  Favors {simulation.interpretation.favors}
                </span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  {simulation.interpretation.iv_environment} IV •{" "}
                  {simulation.interpretation.time_decay_intensity} duration
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.9 }}>
                {simulation.interpretation.favors_explanation}
              </p>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: "8px 0 0 0",
                  opacity: 0.7,
                  fontStyle: "italic",
                }}
              >
                💡 {simulation.interpretation.strategy_hint}
              </p>
            </div>
          )}

          {/* Key Insight */}
          <div
            style={{
              textAlign: "center",
              padding: 12,
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <strong>Key Insight:</strong> {simulation.interpretation?.key_insight}
          </div>
        </>
      )}

      {/* Empty state */}
      {!simulation && !simLoading && (
        <div
          style={{
            textAlign: "center",
            padding: 32,
            opacity: 0.5,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div>Select contract parameters above to simulate time decay</div>
        </div>
      )}

      {/* Disclaimer */}
      <div
        style={{
          fontSize: 11,
          opacity: 0.4,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        Educational tool using Black-Scholes model. Assumes constant IV and flat stock price.
        Real options may behave differently. Not financial advice.
      </div>
    </div>
  );
}