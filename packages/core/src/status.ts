import {
  createDatabase,
  initializeDatabase,
  closeDatabase,
} from "./database/db.js";

export interface ProviderQuotaStatus {
  providerId: string;
  providerName: string;
  ruleId: string;
  ruleName: string;
  used: number;
  limit: number;
  percentage: number;
  freshness: "known" | "unknown" | "stale";
  snapshotTimestamp: number;
}

export function getQuotaStatusSnapshot(): ProviderQuotaStatus[] {
  const db = createDatabase();

  try {
    initializeDatabase(db);
  } catch {
    closeDatabase(db);
    return [];
  }

  try {
    const rows = db
      .prepare(
        `
        SELECT
          p.id AS providerId,
          p.name AS providerName,
          qr.id AS ruleId,
          qr.name AS ruleName,
          qs.used AS used,
          qs."limit" AS "limit",
          qs.percentage AS percentage,
          qs.freshness AS freshness,
          qs.timestamp AS snapshotTimestamp
        FROM quota_snapshots qs
        INNER JOIN quota_rules qr ON qr.id = qs.quota_rule_id
        INNER JOIN providers p ON p.id = qs.provider_id
        WHERE qs.id IN (
          SELECT MAX(id)
          FROM quota_snapshots
          GROUP BY provider_id, quota_rule_id
        )
        ORDER BY p.name ASC, qr.name ASC
      `,
      )
      .all() as ProviderQuotaStatus[];

    return rows;
  } finally {
    closeDatabase(db);
  }
}
