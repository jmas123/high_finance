import type { NewsBundle, NewsHeadline } from "../../lib/types";
import type { CompanyNotification } from "./types";

export function withinLastDays(published: string | null, days: number) {
  if (!published) return false;
  const t = Date.parse(published);
  if (Number.isNaN(t)) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

export function headlineToCompanyNotif(
  section: "watchlist" | "portfolio",
  bundleTicker: string,
  h: NewsHeadline,
  companyName?: string
): CompanyNotification {
  const createdAt =
    h.published && !Number.isNaN(Date.parse(h.published))
      ? new Date(Date.parse(h.published)).toISOString()
      : new Date().toISOString();

  const source = h.source ?? "News";

  return {
    id: `${section}-${bundleTicker}-${createdAt}-${(h.title ?? "").slice(0, 18)}`,
    section,
    created_at: createdAt,
    title: `${bundleTicker} · ${source}`,
    subtitle: h.title,
    url: h.url ?? undefined,
    announcement: {
      ticker: bundleTicker,
      company_name: companyName,
      event_type: "NEWS",
      event_date: createdAt,
      summary: h.title,
    },
  };
}

export function bundleToCompanyNotifs(
  section: "watchlist" | "portfolio",
  bundle: NewsBundle,
  days: number,
  perTickerCap = 3,
  companyName?: string
): CompanyNotification[] {
  return (bundle.headlines ?? [])
    .filter((h) => withinLastDays(h.published ?? null, days))
    .slice(0, perTickerCap)
    .map((h) => headlineToCompanyNotif(section, bundle.ticker, h, companyName));
}
