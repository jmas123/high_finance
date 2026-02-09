// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH PROJECTS – API methods
// ═══════════════════════════════════════════════════════════════════════════════
// Uses shared helpers from lib/api.ts (fetchWithTimeout, getAuthHeaders)

import type {
  ProjectSummary, ProjectDetail, ThesisBullet, Catalyst,
  ProjectRiskItem, ProjectPeer, DCFSnapshot, ProjectSourceItem,
} from "./types";

import { getAuthHeaders, fetchWithTimeout } from "../../lib/api";

const BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(path, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJSONBody<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetchWithTimeout(path, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

// ── Add these methods to your existing `api` object ──────────────────────────

export const projectsApi = {
  // ── Projects ─────────────────────────────────────────────────────────────
  listProjects: (status?: string, ticker?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (ticker) q.set("ticker", ticker);
    const qs = q.toString();
    return getJSON<ProjectSummary[]>(`${BASE}/projects${qs ? `?${qs}` : ""}`);
  },

  getProject: (id: number) =>
    getJSON<ProjectDetail>(`${BASE}/projects/${id}`),

  createProject: (body: {
    ticker: string;
    title: string;
    summary?: string;
    conviction?: string;
    position_type?: string;
  }) => postJSONBody<ProjectDetail>(`${BASE}/projects`, body),

  updateProject: (id: number, body: {
    title?: string;
    summary?: string;
    status?: string;
    conviction?: string;
    position_type?: string;
  }) => patchJSON<ProjectDetail>(`${BASE}/projects/${id}`, body),

  deleteProject: (id: number) =>
    del(`${BASE}/projects/${id}`),

  // ── Thesis ───────────────────────────────────────────────────────────────
  addThesis: (projectId: number, text: string, sortOrder = 0) =>
    postJSONBody<ThesisBullet>(`${BASE}/projects/${projectId}/thesis`, {
      text,
      sort_order: sortOrder,
    }),

  updateThesis: (projectId: number, bulletId: number, body: { text?: string; sort_order?: number }) =>
    patchJSON<ThesisBullet>(`${BASE}/projects/${projectId}/thesis/${bulletId}`, body),

  deleteThesis: (projectId: number, bulletId: number) =>
    del(`${BASE}/projects/${projectId}/thesis/${bulletId}`),

  reorderThesis: (projectId: number, orderedIds: number[]) =>
    putJSON<ThesisBullet[]>(`${BASE}/projects/${projectId}/thesis/reorder`, {
      ordered_ids: orderedIds,
    }),

  // ── Catalysts ────────────────────────────────────────────────────────────
  addCatalyst: (projectId: number, body: {
    title: string;
    description?: string;
    expected_date?: string;
  }) => postJSONBody<Catalyst>(`${BASE}/projects/${projectId}/catalysts`, body),

  updateCatalyst: (projectId: number, catalystId: number, body: {
    title?: string;
    description?: string;
    expected_date?: string;
    status?: string;
    outcome_notes?: string;
  }) => patchJSON<Catalyst>(`${BASE}/projects/${projectId}/catalysts/${catalystId}`, body),

  deleteCatalyst: (projectId: number, catalystId: number) =>
    del(`${BASE}/projects/${projectId}/catalysts/${catalystId}`),

  // ── Risks ────────────────────────────────────────────────────────────────
  addRisk: (projectId: number, body: {
    title: string;
    description?: string;
    severity?: string;
  }) => postJSONBody<ProjectRiskItem>(`${BASE}/projects/${projectId}/risks`, body),

  updateRisk: (projectId: number, riskId: number, body: {
    title?: string;
    description?: string;
    severity?: string;
    status?: string;
  }) => patchJSON<ProjectRiskItem>(`${BASE}/projects/${projectId}/risks/${riskId}`, body),

  deleteRisk: (projectId: number, riskId: number) =>
    del(`${BASE}/projects/${projectId}/risks/${riskId}`),

  // ── Peers ────────────────────────────────────────────────────────────────
  addPeer: (projectId: number, ticker: string, companyName?: string) =>
    postJSONBody<ProjectPeer>(`${BASE}/projects/${projectId}/peers`, {
      ticker,
      company_name: companyName,
    }),

  removePeer: (projectId: number, peerId: number) =>
    del(`${BASE}/projects/${projectId}/peers/${peerId}`),

  // ── DCF Snapshots ────────────────────────────────────────────────────────
  listDCFSnapshots: (projectId: number) =>
    getJSON<DCFSnapshot[]>(`${BASE}/projects/${projectId}/dcf-snapshots`),

  saveDCFSnapshot: (projectId: number, body: {
    label?: string;
    growth: number;
    margin: number;
    tax: number;
    wacc: number;
    terminal_g: number;
    fair_value_per_share?: number;
    enterprise_value?: number;
    current_price?: number;
    notes?: string;
  }) => postJSONBody<DCFSnapshot>(`${BASE}/projects/${projectId}/dcf-snapshots`, body),

  getDCFSnapshot: (projectId: number, snapshotId: number) =>
    getJSON<DCFSnapshot>(`${BASE}/projects/${projectId}/dcf-snapshots/${snapshotId}`),

  // ── Sources ──────────────────────────────────────────────────────────────
  addSource: (projectId: number, body: {
    source_type: string;
    title: string;
    url?: string;
    notes?: string;
  }) => postJSONBody<ProjectSourceItem>(`${BASE}/projects/${projectId}/sources`, body),

  deleteSource: (projectId: number, sourceId: number) =>
    del(`${BASE}/projects/${projectId}/sources/${sourceId}`),

deleteDCFSnapshot: (projectId: number, snapshotId: number) =>
  del(`${BASE}/projects/${projectId}/dcf-snapshots/${snapshotId}`),

 getReturns: (tickers: string[], days: number) => {
    const q = new URLSearchParams();
    q.set("tickers", tickers.join(","));
    q.set("days", String(days));
    return getJSON<Record<string, number | null>>(`${BASE}/prices/returns?${q.toString()}`);
  },

  /**
   * Export project as full tearsheet Excel file
   * Returns a Blob that can be downloaded
   */
  exportProjectToExcel: async (projectId: number): Promise<Blob> => {
    const res = await fetchWithTimeout(`${BASE}/projects/${projectId}/export/excel`, {
      headers: { ...getAuthHeaders() },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Export failed" }));
      throw new Error(err.detail || "Export failed");
    }

    return res.blob();
  },
};
