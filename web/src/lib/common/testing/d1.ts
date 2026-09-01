import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* テスト専用。better-sqlite3 を D1 と同じ形で呼べるようにする薄い皮。
   使うのは prepare / bind / all / first / run だけ */

function wrap(statement: Database.Statement, binds: unknown[] = []) {
	return {
		bind: (...values: unknown[]) => wrap(statement, values),
		all: async <T>() => ({ results: statement.all(...binds) as T[] }),
		first: async <T>() => (statement.get(...binds) as T) ?? null,
		run: async () => {
			statement.run(...binds);
		}
	};
}

/** マイグレーション適用済みのインメモリ DB を作る */
export function createTestDb(): D1Database {
	const db = new Database(':memory:');
	const migrationsDir = path.resolve(
		fileURLToPath(import.meta.url),
		'../../../../../../db/migrations'
	);
	for (const file of readdirSync(migrationsDir).sort()) {
		db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
	}
	return { prepare: (sql: string) => wrap(db.prepare(sql)) } as unknown as D1Database;
}
