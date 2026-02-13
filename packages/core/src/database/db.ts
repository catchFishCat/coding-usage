/**
 * Database Connection and Initialization
 *
 * Provides database factory, initialization, and connection management.
 *
 * Reference: cc-switch database initialization pattern
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import {
  runMigrations,
  validateSchema,
  getSchemaVersion,
  CURRENT_SCHEMA_VERSION,
} from "./migrations.js";

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  dataDir: string; // Directory containing database files
  filename?: string; // Database filename (default: 'coding-usage.db')
  readonly?: boolean; // Open in readonly mode
  verbose?: boolean; // Enable query logging
}

/**
 * Default database configuration
 */
const DEFAULT_CONFIG: DatabaseConfig = {
  dataDir:
    process.env.CODING_USAGE_DATA_DIR || path.join(process.cwd(), "data"),
  filename: "coding-usage.db",
  readonly: false,
  verbose: process.env.CODING_USAGE_DB_VERBOSE === "true",
};

/**
 * Create or open database connection
 *
 * @param config - Database configuration
 * @returns Database instance
 */
export function createDatabase(config: Partial<DatabaseConfig> = {}): Database {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Ensure data directory exists
  if (!fs.existsSync(finalConfig.dataDir)) {
    fs.mkdirSync(finalConfig.dataDir, { recursive: true });
  }

  const dbPath = path.join(
    finalConfig.dataDir,
    finalConfig.filename || "coding-usage.db",
  );

  const verboseLogger = finalConfig.verbose ? console.log : undefined;

  const db = new Database(dbPath, {
    readonly: finalConfig.readonly,
    verbose: verboseLogger,
    fileMustExist: false,
  });

  // Enable WAL mode for better concurrent access
  db.pragma("journal_mode = WAL");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  return db;
}

/**
 * Initialize database with schema and migrations
 *
 * @param db - Database instance
 * @returns True if initialization was needed
 */
export function initializeDatabase(db: Database): boolean {
  let existingVersion: string | null = null;
  try {
    existingVersion = getSchemaVersion(db);
  } catch {
    existingVersion = null;
  }
  const needsInit = !existingVersion;

  // Run migrations (idempotent - does nothing if up to date)
  runMigrations(db);

  // Validate final schema
  if (!validateSchema(db)) {
    throw new Error(
      `Schema validation failed. Expected version ${CURRENT_SCHEMA_VERSION}, got ${getSchemaVersion(db)}`,
    );
  }

  return needsInit;
}

/**
 * Factory function - creates and initializes database
 *
 * @param config - Database configuration
 * @returns Initialized database instance, or true if initialization was needed
 */
export function createInitializedDatabase(
  config: Partial<DatabaseConfig> = {},
): Database | boolean {
  const db = createDatabase(config);
  const neededInit = initializeDatabase(db);
  return neededInit ? db : db;
}

/**
 * Close database connection
 *
 * @param db - Database instance
 */
export function closeDatabase(db: Database): void {
  db.close();
}

/**
 * Check if database is open
 *
 * @param db - Database instance
 */
export function isDatabaseOpen(db: Database): boolean {
  return db.open;
}

/**
 * Get database file path
 *
 * @param config - Database configuration
 */
export function getDatabasePath(config: Partial<DatabaseConfig> = {}): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return path.join(
    finalConfig.dataDir,
    finalConfig.filename || "coding-usage.db",
  );
}

/**
 * Export for use in tests
 */
export { Database };
