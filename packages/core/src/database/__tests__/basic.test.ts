/**
 * Basic Database Functionality Tests
 *
 * Simple tests to verify core database operations work
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { createInitializedDatabase } from '../db.ts';

describe('Database Basic Operations', () => {
  let dbPath: string;

  beforeEach(() => {
    const tempDir = tmpdir();
    dbPath = `${tempDir}/test-${randomUUID()}.db`;
  });

  test('should create and initialize database', () => {
    // Act
    const db = createInitializedDatabase({ filename: dbPath });

    // Assert
    expect(db).toBeDefined();
    expect(typeof db).toBe('object');

    // Clean up
    (db as Database).close();
  });

  test('should be idempotent when initialized twice', () => {
    // Arrange
    const db1 = createInitializedDatabase({ filename: dbPath });
    (db1 as Database).close();

    // Act - initialize again
    const db2 = createInitializedDatabase({ filename: dbPath });

    // Assert
    expect(db2).toBe(false); // Should return false when already initialized

    // Clean up
    if (db2 && typeof db2 === 'object') {
      (db2 as Database).close();
    }
  });

  test('should create schema_version table', () => {
    // Act
    const db = createInitializedDatabase({ filename: dbPath }) as Database;

    const tableExists = db.tableExists('schema_version');

    // Assert
    expect(tableExists).toBe(true);

    db.close();
  });

  test('should create providers table', () => {
    // Act
    const db = createInitializedDatabase({ filename: dbPath }) as Database;

    const tableExists = db.tableExists('providers');

    // Assert
    expect(tableExists).toBe(true);

    db.close();
  });

  test('should create quota_rules table', () => {
    // Act
    const db = createInitializedDatabase({ filename: dbPath }) as Database;

    const tableExists = db.tableExists('quota_rules');

    // Assert
    expect(tableExists).toBe(true);

    db.close();
  });

  test('should create usage_records table', () => {
    // Act
    const db = createInitializedDatabase({ filename: dbPath }) as Database;

    const tableExists = db.tableExists('usage_records');

    // Assert
    expect(tableExists).toBe(true);

    db.close();
  });
});
