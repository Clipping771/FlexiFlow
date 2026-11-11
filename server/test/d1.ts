// Minimal in-memory D1 for unit tests: the subset of the D1 API the routes use, on sql.js.
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';

const migrationsDir = path.resolve(__dirname, '../migrations');

class Statement {
  constructor(private db: Database, private sql: string, private params: SqlValue[] = []) {}

  bind(...params: unknown[]) {
    return new Statement(this.db, this.sql, params as SqlValue[]);
  }

  private rows<T>(): T[] {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.bind(this.params);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.rows<Record<string, unknown>>()[0];
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T>() {
    return { results: this.rows<T>(), success: true, meta: {} };
  }

  async run() {
    this.db.run(this.sql, this.params);
    return { success: true, meta: { changes: this.db.getRowsModified() } };
  }
}

export interface TestD1 {
  db: D1Database;
  /** Run raw SQL, e.g. to seed rows or break the database. */
  exec(sql: string, params?: SqlValue[]): void;
  close(): void;
}

export async function createTestD1(): Promise<TestD1> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    raw.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  const db = { prepare: (sql: string) => new Statement(raw, sql) } as unknown as D1Database;
  return {
    db,
    exec: (sql, params = []) => raw.run(sql, params),
    close: () => raw.close()
  };
}
