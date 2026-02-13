declare module 'better-sqlite3' {
  class Database {
    constructor(filename: string, options?: any);
    prepare(sql: string): Statement;
    exec(sql: string): void;
    pragma(sql: string): void;
    close(): void;
    tableExists(name: string): boolean;
    open: boolean;
    transaction<T>(fn: (db: Database) => T): T;
  }

  class Statement {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: bigint;
  }

  export default Database;
}
