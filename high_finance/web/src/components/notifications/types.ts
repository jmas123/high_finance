import type { Politician, PoliticianTrade, TradeContext } from "../../lib/types";

type NotificationSection = "politicians" | "watchlist" | "portfolio";

type BaseNotification = {
  id: string;                 // stable unique id
  section: NotificationSection;
  created_at: string;         // for sorting
  title: string;              // one-line headline
  subtitle?: string;          // small grey line
  severity?: "low" | "med" | "high";
  url?: string;
};

type PoliticianNotification = BaseNotification & {
  section: "politicians";
  trade: PoliticianTrade;
  politician: Politician;
  context?: TradeContext;
};

type CompanyAnnouncement = {
  ticker: string;
  company_name?: string;
  event_type: string;         // "EARNINGS", "8-K", "GUIDANCE", "NEWS", ...
  event_date?: string;
  summary?: string;
};

type CompanyNotification = BaseNotification & {
  section: "watchlist" | "portfolio";
  announcement: CompanyAnnouncement;
  context?: TradeContext;     // optional, reuse your “why it matters” box
};

type NotificationItem = PoliticianNotification | CompanyNotification;
