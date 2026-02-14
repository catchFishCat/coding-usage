import Database from "better-sqlite3";

import { pruneProviderRules } from "../db";

describe("polling db helpers", () => {
  test("pruneProviderRules removes stale rules and their snapshots", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE quota_rules (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL
      );
      CREATE TABLE quota_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quota_rule_id TEXT NOT NULL
      );
    `);

    db.prepare(
      "INSERT INTO quota_rules (id, provider_id) VALUES (?, ?), (?, ?), (?, ?)",
    ).run("keep-a", "gemini", "drop-b", "gemini", "keep-c", "gemini");
    db.prepare(
      "INSERT INTO quota_snapshots (quota_rule_id) VALUES (?), (?), (?)",
    ).run("keep-a", "drop-b", "keep-c");

    pruneProviderRules(db, "gemini", ["keep-a", "keep-c"]);

    const rules = db
      .prepare(
        "SELECT id FROM quota_rules WHERE provider_id = 'gemini' ORDER BY id",
      )
      .all() as Array<{ id: string }>;
    const snapshots = db
      .prepare(
        "SELECT quota_rule_id FROM quota_snapshots ORDER BY quota_rule_id",
      )
      .all() as Array<{ quota_rule_id: string }>;

    expect(rules.map((row) => row.id)).toEqual(["keep-a", "keep-c"]);
    expect(snapshots.map((row) => row.quota_rule_id)).toEqual([
      "keep-a",
      "keep-c",
    ]);

    db.close();
  });
});
