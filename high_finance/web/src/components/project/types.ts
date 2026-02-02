

export type ProjectStatus = "active" | "archived" | "closed";
export type Conviction = "high" | "medium" | "low";
export type PositionType = "long" | "short" | "watching";
export type CatalystStatus = "pending" | "occurred" | "missed";
export type RiskSeverity = "low" | "medium" | "high";
export type RiskStatus = "active" | "mitigated" | "realized";
export type SourceType = "filing" | "earnings_call" | "news" | "note" | "other";

// ── Child entities ───────────────────────────────────────────────────────────

export type ThesisBullet = {
  id: number;
  text: string;
  sort_order: number;
  created_at: string;
};

export type Catalyst = {
  id: number;
  title: string;
  description: string | null;
  expected_date: string | null;
  status: CatalystStatus;
  outcome_notes: string | null;
  created_at: string;
};

export type ProjectRiskItem = {
  id: number;
  title: string;
  description: string | null;
  severity: RiskSeverity;
  status: RiskStatus;
  created_at: string;
};

export type ProjectPeer = {
  id: number;
  ticker: string;
  company_name: string | null;
  added_at: string;
};

export type DCFSnapshot = {
  id: number;
  version: number;
  label: string | null;
  growth: number;
  margin: number;
  tax: number;
  wacc: number;
  terminal_g: number;
  fair_value_per_share: number | null;
  enterprise_value: number | null;
  current_price: number | null;
  notes: string | null;
  created_at: string;
};

export type ProjectSourceItem = {
  id: number;
  source_type: SourceType;
  title: string;
  url: string | null;
  notes: string | null;
  linked_at: string;
};

// ── Project (list view) ──────────────────────────────────────────────────────

export type ProjectSummary = {
  id: number;
  ticker: string;
  title: string;
  status: ProjectStatus;
  conviction: Conviction | null;
  position_type: PositionType | null;
  created_at: string;
  updated_at: string;
  thesis_count: number;
  catalyst_count: number;
  risk_count: number;
  latest_fair_value: number | null;
};

// ── Project (detail view) ────────────────────────────────────────────────────

export type ProjectDetail = {
  id: number;
  ticker: string;
  title: string;
  summary: string | null;
  status: ProjectStatus;
  conviction: Conviction | null;
  position_type: PositionType | null;
  created_at: string;
  updated_at: string;
  thesis_bullets: ThesisBullet[];
  catalysts: Catalyst[];
  risks: ProjectRiskItem[];
  peers: ProjectPeer[];
  dcf_snapshots: DCFSnapshot[];
  sources: ProjectSourceItem[];
};
export interface ProjectWorkspaceProps {
  projectId: number;
  /** Navigate back to project list / dashboard */
  onBack: () => void;
  /** Navigate to ticker view (loads full ticker data) */
  onOpenTicker: (ticker: string) => void;
  /**
   * Navigate to the DCF model page for this project's ticker.
   * The parent should set `currentDCF` with the slider values when the user
   * navigates back so the import banner appears.
   * If not provided, falls back to `onOpenTicker`.
   */
  onOpenDCF?: (ticker: string) => void;
  /** Current DCF state from the DCFCard – lets user snapshot it */
  currentDCF?: {
    growth: number;
    margin: number;
    tax: number;
    wacc: number;
    terminal_g: number;
    fair_value_per_share: number | null;
    enterprise_value: number | null;
    current_price: number | null;
  } | null;
  /** Called after user imports currentDCF so parent can clear it */
  onDCFImported?: () => void;
}

export const defaultDCFInputs = {
  growth: "10",
  margin: "20",
  tax: "21",
  wacc: "10",
  terminal_g: "2.5",
  fair_value: "",
  enterprise_value: "",
  current_price: "",
};