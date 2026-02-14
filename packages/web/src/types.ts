/**
 * Type definitions for quota dashboard
 */

export type Freshness = "known" | "unknown" | "stale";

export interface QuotaItem {
  providerId: string;
  providerName: string;
  ruleId: string;
  ruleName: string;
  used: number;
  limit: number;
  percentage: number;
  freshness: Freshness;
  snapshotTimestamp: number;
}

export interface StatusResponse {
  generatedAt: number;
  count: number;
  data: QuotaItem[];
}

export interface GroupedQuotas {
  providerName: string;
  providerId: string;
  items: QuotaItem[];
}

export type LoadingState = "idle" | "loading" | "success" | "error" | "empty";

export interface DashboardState {
  data: StatusResponse | null;
  state: LoadingState;
  error: string | null;
  lastRefreshed: number | null;
}
