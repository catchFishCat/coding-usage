import { randomUUID } from "node:crypto";

export function upsertProvider(
  db: any,
  id: string,
  name: string,
  category = "official",
): void {
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO providers (id, name, category, enabled, config, created_at, updated_at)
    VALUES (?, ?, ?, 1, '{}', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      updated_at = excluded.updated_at
  `,
  ).run(id, name, category, now, now);
}

export function upsertRule(
  db: any,
  providerId: string,
  ruleId: string,
  name: string,
  type: "balance" | "fixed_window",
  limit: number,
  unit: "credits" | "requests",
): string {
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO quota_rules (
      id, provider_id, name, enabled, type, "limit", unit,
      alert_thresholds, created_at, updated_at
    )
    VALUES (?, ?, ?, 1, ?, ?, ?, '[0.7,0.85,0.95]', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      "limit" = excluded."limit",
      unit = excluded.unit,
      updated_at = excluded.updated_at
  `,
  ).run(ruleId, providerId, name, type, limit, unit, now, now);

  return ruleId;
}

export function insertUsageRecord(
  db: any,
  providerId: string,
  source: "api",
  raw: unknown,
): void {
  db.prepare(
    `
    INSERT INTO usage_records (
      id, provider_id, timestamp, source, scope, raw_data
    ) VALUES (?, ?, ?, ?, 'personal', ?)
  `,
  ).run(randomUUID(), providerId, Date.now(), source, JSON.stringify(raw));
}

export function insertQuotaSnapshot(
  db: any,
  providerId: string,
  ruleId: string,
  used: number,
  limit: number,
): void {
  const percentage = limit > 0 ? Math.max(0, Math.min(1, used / limit)) : 0;
  db.prepare(
    `
    INSERT INTO quota_snapshots (
      provider_id, quota_rule_id, timestamp, used, "limit", percentage,
      resets_at, predicted_exhaust_at, freshness, data_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'known', ?)
  `,
  ).run(providerId, ruleId, Date.now(), used, limit, percentage, Date.now());
}
