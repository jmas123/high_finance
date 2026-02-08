import React, { useMemo, useState } from "react";
import { Globe, LayoutGrid, Activity, Percent } from "lucide-react";
import MacroOverlayCard from "./MacroOverlayCard";
import SectorHeatmapCard from "./SectorHeatMap";
import RateImpactCard from "./RateImpactCard";
import type { MacroResponse, SectorResponse, RateImpactResponse } from "../../lib/types";

type Tab = "overview" | "macro" | "sectors" | "rates";

interface BroaderMarketContextProps {
  ticker?: string;
  sector?: string;
  showMacro?: boolean;
  showSectors?: boolean;
  showRateImpact?: boolean;
  initialMacroData?: MacroResponse | null;
  initialSectorsData?: SectorResponse | null;
  initialRateImpactData?: RateImpactResponse | null;
}

const C = {
  bg: "#111",
  border: "#333",
  text: "#e4e4e7",
  textSec: "#a1a1aa",
  textMuted: "#71717a",
  blue: "#60a5fa",
};

const BroaderMarketContext: React.FC<BroaderMarketContextProps> = ({
  ticker,
  sector,
  showMacro = true,
  showSectors = true,
  showRateImpact = true,
  initialMacroData,
  initialSectorsData,
  initialRateImpactData,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview", Icon: LayoutGrid, show: true },
        { id: "macro" as const, label: "Macro", Icon: Globe, show: showMacro },
        { id: "sectors" as const, label: "Sectors", Icon: Activity, show: showSectors },
        { id: "rates" as const, label: "Rates", Icon: Percent, show: showRateImpact },
      ].filter((t) => t.show),
    [showMacro, showSectors, showRateImpact]
  );

  return (
    <div style={{ width: "100%" }}>

      {/* ─── Header & Tabs ─── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 16,
        flexWrap: "wrap",
      }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            padding: 8,
            background: "rgba(59,130,246,0.1)",
            borderRadius: 8,
            border: "1px solid rgba(59,130,246,0.2)",
            display: "flex",
          }}>
            <Globe size={20} color={C.blue} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3 }}>
              Market Context
            </h2>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0, marginTop: 2 }}>
              {ticker ? `External influences on ${ticker}` : "Global macro & sector trends"}
            </p>
          </div>
        </div>

        {/* Segmented Tabs */}
        <div style={{
          display: "flex",
          background: "#222",
          padding: 3,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const { Icon } = tab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "#444" : "transparent",
                  color: isActive ? "#fff" : C.textMuted,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = C.textMuted; }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ minHeight: 500 }}>

        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 16 }}>
            {/* Left column: Macro + Rates stacked */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {showMacro && <MacroOverlayCard ticker={ticker} initialData={initialMacroData} />}
              {showRateImpact && (
                <RateImpactCard
                  ticker={ticker}
                  sector={sector}
                  currentRateEnvironment="stable"
                  initialData={initialRateImpactData}
                />
              )}
            </div>
            {/* Right column: Heatmap */}
            <div style={{ minHeight: 500 }}>
              {showSectors && <SectorHeatmapCard highlightSector={sector} initialData={initialSectorsData} />}
            </div>
          </div>
        )}

        {activeTab === "macro" && showMacro && <MacroOverlayCard ticker={ticker} initialData={initialMacroData} />}
        {activeTab === "sectors" && showSectors && <SectorHeatmapCard highlightSector={sector} initialData={initialSectorsData} />}
        {activeTab === "rates" && showRateImpact && (
          <RateImpactCard ticker={ticker} sector={sector} currentRateEnvironment="stable" initialData={initialRateImpactData} />
        )}
      </div>
    </div>
  );
};

export default BroaderMarketContext;