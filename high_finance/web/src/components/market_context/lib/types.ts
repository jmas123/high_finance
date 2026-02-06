interface TopMover {
  symbol: string;
  change: number;
}

export interface SectorData {
  sector: string;
  ticker: string;
  performance_1d: number;
  performance_1w: number;
  performance_1m: number;
  performance_ytd: number;
  volume_vs_avg: number;
  market_cap_billions: number;
  top_movers: TopMover[];
}

export interface SectorResponse {
  sectors: SectorData[];
  market_leader: string;
  market_laggard: string;
  breadth: {
    positive: number;
    negative: number;
    unchanged: number;
  };
}

export type TimeFrame = "1d" | "1w" | "1m" | "ytd";

export interface SectorHeatmapCardProps {
  highlightSector?: string;
  onSectorClick?: (sector: SectorData) => void;
  initialData?: SectorResponse | null;
}

