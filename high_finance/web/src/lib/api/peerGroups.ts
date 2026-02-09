/**
 * Peer Groups API
 * ===============
 * CRUD operations for user's custom peer groups.
 */

const BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";
const TOKEN_KEY = "hf_access_token";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// Types
export type PeerGroup = {
  id: number;
  user_id: string;
  ticker: string | null;
  name: string;
  peer_tickers: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
};

export type PeerGroupList = {
  items: PeerGroup[];
  total: number;
  limit: number;
  offset: number;
};

export type PeerGroupCreate = {
  ticker?: string | null;
  name: string;
  peer_tickers: string[];
  is_default?: boolean;
};

export type PeerGroupUpdate = {
  name?: string;
  peer_tickers?: string[];
  is_default?: boolean;
};

// API Functions
export const peerGroupsApi = {
  /**
   * List peer groups for the current user.
   * Optionally filter by ticker to get groups relevant to a specific company.
   */
  list: async (params?: {
    ticker?: string;
    limit?: number;
    offset?: number;
  }): Promise<PeerGroupList> => {
    const query = new URLSearchParams();
    if (params?.ticker) query.set("ticker", params.ticker);
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));

    const qs = query.toString();
    const res = await fetch(`${BASE}/me/peer-groups${qs ? `?${qs}` : ""}`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Authentication required");
      throw new Error("Failed to fetch peer groups");
    }

    return res.json();
  },

  /**
   * Get a single peer group by ID.
   */
  get: async (groupId: number): Promise<PeerGroup> => {
    const res = await fetch(`${BASE}/me/peer-groups/${groupId}`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Authentication required");
      if (res.status === 404) throw new Error("Peer group not found");
      throw new Error("Failed to fetch peer group");
    }

    return res.json();
  },

  /**
   * Create a new peer group.
   */
  create: async (data: PeerGroupCreate): Promise<PeerGroup> => {
    const res = await fetch(`${BASE}/me/peer-groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Authentication required");
      if (res.status === 409) throw new Error("A peer group with this name already exists");
      if (res.status === 400) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Invalid peer group data");
      }
      throw new Error("Failed to create peer group");
    }

    return res.json();
  },

  /**
   * Update an existing peer group.
   */
  update: async (groupId: number, data: PeerGroupUpdate): Promise<PeerGroup> => {
    const res = await fetch(`${BASE}/me/peer-groups/${groupId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Authentication required");
      if (res.status === 404) throw new Error("Peer group not found");
      if (res.status === 409) throw new Error("A peer group with this name already exists");
      throw new Error("Failed to update peer group");
    }

    return res.json();
  },

  /**
   * Delete a peer group.
   */
  delete: async (groupId: number): Promise<void> => {
    const res = await fetch(`${BASE}/me/peer-groups/${groupId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok && res.status !== 204) {
      if (res.status === 401) throw new Error("Authentication required");
      if (res.status === 404) throw new Error("Peer group not found");
      throw new Error("Failed to delete peer group");
    }
  },
};

/**
 * Export comps table to Excel.
 */
export async function exportCompsToExcel(
  ticker: string,
  options?: {
    peer_group_id?: number;
    peers?: string[];
    format?: "xlsx" | "csv";
  }
): Promise<Blob> {
  const res = await fetch(`${BASE}/companies/${encodeURIComponent(ticker)}/comps/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      format: options?.format || "xlsx",
      peer_group_id: options?.peer_group_id,
      peers: options?.peers,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(err.detail || "Export failed");
  }

  return res.blob();
}

/**
 * Download a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
