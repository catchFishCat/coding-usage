/**
 * Database Migration System
 *
 * Handles schema versioning, upgrades, and idempotent migration execution.
 * Each migration is versioned and can be applied safely to existing databases.
 *
 * Reference: cc-switch migration pattern
 */

import Database from 'better-sqlite3';
import { fullSchema } from './schema.js';

/**
 * Current schema version
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Migration record
 */
export interface Migration {
  version: string;
  description: string;
  up: string;        // SQL to apply migration
  down?: string;     // SQL to rollback migration (optional)
}

/**
 * All migrations in version order
 */
export const migrations: Migration[] = [
  {
    version: '1.0.0',
    description: 'Initial schema - providers, quota rules, usage records, alerts',
    up: fullSchema,
  },
];

/**
 * Get current schema version from database
 */
export function getSchemaVersion(db: Database): string | null {
  const row = db
    .prepare('SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1')
    .get() as { version: string } | undefined;

  return row?.version ?? null;
}

/**
 * Check if a migration has already been applied
 */
export function isMigrationApplied(db: Database, version: string): boolean {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM schema_version WHERE version = ?')
    .get(version) as { count: number } | undefined;

  return (row?.count ?? 0) > 0;
}

/**
 * Apply a single migration within a transaction
 */
export function applyMigration(db: Database, migration: Migration): void {
  db.transaction(() => {
    // Apply the migration SQL
    db.exec(migration.up);

    // Record the migration
    const now = Date.now();
    db.prepare(
      'INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)'
    ).run(migration.version, now, migration.description);
  });
}

/**
 * Rollback a migration (if down migration is defined)
 */
export function rollbackMigration(db: Database, migration: Migration): void {
  if (!migration.down) {
    throw new Error(`Migration ${migration.version} does not support rollback`);
  }

  db.transaction(() => {
    // Remove migration record
    db.prepare('DELETE FROM schema_version WHERE version = ?').run(migration.version);

    // Apply rollback SQL
    if (migration.down) {
      db.exec(migration.down);
    }
  });
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database): void {
  // Ensure schema_version table exists first
  if (!db.tableExists('schema_version')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT NOT NULL PRIMARY KEY,
        applied_at INTEGER NOT NULL,
        description TEXT
      )
    `);
  }

  const currentVersion = getSchemaVersion(db);

  // Find pending migrations
  const pendingMigrations = migrations.filter((m) => {
    if (!currentVersion) return true;
    return m.version > currentVersion;
  });

  if (pendingMigrations.length === 0) {
    return;
  }

  // Apply migrations in order
  for (const migration of pendingMigrations) {
    applyMigration(db, migration);
  }
}

/**
 * Validate database schema matches expected version
 */
export function validateSchema(db: Database, expectedVersion = CURRENT_SCHEMA_VERSION): boolean {
  const currentVersion = getSchemaVersion(db);
  return currentVersion === expectedVersion;
}

/**
 * Get migration status for all migrations
 */
export function getMigrationStatus(db: Database): Array<{
  version: string;
  description: string;
  applied: boolean;
}> {
  return migrations.map((m) => ({
    version: m.version,
    description: m.description,
    applied: isMigrationApplied(db, m.version),
  }));
}

// Export all migrations for testing
export { migrations as allMigrations };
