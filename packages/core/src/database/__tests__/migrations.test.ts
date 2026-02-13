/**
 * Migration System Tests
 *
 * Tests database schema creation, migration execution, and idempotency.
 * Following TDD principles - write failing test, implement, verify pass.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { runMigrations, getSchemaVersion, validateSchema } from '../migrations.js';
import { createInitializedDatabase } from '../db.js';

describe('Database Migrations', () => {
  let dbPath: string;

  beforeEach(() => {
    // Create unique temp database for each test
    const tempDir = tmpdir();
    dbPath = `${tempDir}/test-${randomUUID()}.db`;
  });

  describe('C.32-33: Fresh Initialization', () => {
    test('should create all tables on fresh init', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Assert - all tables should exist
      const tableNames = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];

      const actualTables = tableNames.map((t) => t.name).filter(Boolean);
      const expectedTables = [
        'schema_version',
        'providers',
        'provider_endpoints',
        'quota_rules',
        'usage_records',
        'quota_snapshots',
        'alert_events',
        'adapter_sync_state',
        'provider_health',
        'model_pricing',
        'daily_summaries',
        'reconciliation_runs',
      ];

      expect(actualTables).toEqual(expect.arrayContaining(expectedTables));
      expect(actualTables.length).toBeGreaterThanOrEqual(expectedTables.length);

      db.close();
    });

    test('should create all indexes on fresh init', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Assert - indexes should exist
      const indexNames = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
        .all() as { name: string }[];

      const actualIndexes = indexNames.map((i) => i.name);

      expect(actualIndexes).toContain('idx_usage_provider_ts');
      expect(actualIndexes).toContain('idx_snapshot_rule_ts');
      expect(actualIndexes).toContain('idx_alert_ts');

      db.close();
    });

    test('should track schema version', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      const row = db
        .prepare('SELECT version, applied_at, description FROM schema_version')
        .get() as { version: string; applied_at: number; description: string } | undefined;

      // Assert
      expect(row).toBeDefined();
      expect(row?.version).toBe('1.0.0');
      expect(row?.applied_at).toBeGreaterThan(0);
      expect(row?.description).toContain('Initial schema');

      db.close();
    });
  });

  describe('C.34-35: Idempotent Migration Rerun', () => {
    test('should not fail when running migrations twice', () => {
      // Arrange - first migration
      const db = createInitializedDatabase({ filename: dbPath }) as Database;
      const versionAfterFirst = getSchemaVersion(db);

      // Act - run migrations again on same database
      runMigrations(db);
      const versionAfterSecond = getSchemaVersion(db);

      // Assert - version should be unchanged
      expect(versionAfterFirst).not.toBeNull();
      expect(versionAfterSecond).toBe(versionAfterFirst);

      db.close();
    });
  });

  describe('C.36-37: Version Tracking and Validation', () => {
    test('should validate schema matches expected version', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Assert
      const isValid = validateSchema(db);
      expect(isValid).toBe(true);

      db.close();
    });
  });

  describe('C.38-39: Provider Health and Reconciliation Tables', () => {
    test('should create provider_health table', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Assert
      const tableExists = db.tableExists('provider_health');
      expect(tableExists).toBe(true);

      db.close();
    });

    test('should create adapter_sync_state table', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Assert
      const tableExists = db.tableExists('adapter_sync_state');
      expect(tableExists).toBe(true);

      db.close();
    });

    test('should create reconciliation_runs table', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Assert
      const tableExists = db.tableExists('reconciliation_runs');
      expect(tableExists).toBe(true);

      db.close();
    });

    test('should support insert into reconciliation_runs', () => {
      // Act
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      const insert = db.prepare(`
        INSERT INTO reconciliation_runs (
          provider_id, run_timestamp, records_compared,
          discrepancies_found, drift_threshold, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insert.run('test-provider', Date.now(), 100, 0, 0.1, 'success', Date.now());

      // Assert
      expect(result.changes).toBe(1);

      db.close();
    });
  });

  describe('Foreign Key Constraints', () => {
    test('should enforce foreign key on quota_rules.provider_id', () => {
      // Arrange
      const db = createInitializedDatabase({ filename: dbPath }) as Database;

      // Add a provider first
      db.prepare('INSERT INTO providers (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
        'test-provider',
        'Test Provider',
        Date.now(),
        Date.now()
      );

      // Act & Assert - should fail with non-existent provider
      expect(() => {
        db.prepare(`
          INSERT INTO quota_rules (
            id, provider_id, name, type, limit, unit,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('test-rule', 'non-existent-provider', 'Test', 'sliding_window', 100, 'requests', Date.now(), Date.now());
      }).toThrow();

      db.close();
    });
  });
});
