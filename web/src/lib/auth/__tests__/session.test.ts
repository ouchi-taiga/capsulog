import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb } from '$lib/common/testing/d1';
import {
	createSession,
	deleteSession,
	deleteUserSessions,
	findUserBySession
} from '../session.server';

async function setup() {
	const db = createTestDb();
	await db
		.prepare(`INSERT INTO users (id, created_at, updated_at) VALUES (1, ?, ?), (2, ?, ?)`)
		.bind(
			'2026-09-01T00:00:00.000Z',
			'2026-09-01T00:00:00.000Z',
			'2026-09-01T00:00:00.000Z',
			'2026-09-01T00:00:00.000Z'
		)
		.run();
	return db;
}

/** 生のトークンが DB にそのまま入っていないこと。漏れても使えないため */
async function storedIds(db: D1Database): Promise<string[]> {
	const { results } = await db.prepare('SELECT id FROM sessions').all<{ id: string }>();
	return results.map((row) => row.id);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('createSession', () => {
	it('作ったトークンでユーザーを引ける', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		expect((await findUserBySession(db, token))?.id).toBe(1);
	});

	it('DB にはトークンをそのまま入れない', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		expect(await storedIds(db)).not.toContain(token);
	});

	it('期限切れの行を消す', async () => {
		const db = await setup();
		await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-19T00:00:00.000Z')); // 7日を過ぎている
		await createSession(db, 1);
		expect(await storedIds(db)).toHaveLength(1);
	});

	it('他のユーザーの期限切れは消さない', async () => {
		const db = await setup();
		await createSession(db, 2);
		vi.setSystemTime(new Date('2026-09-19T00:00:00.000Z'));
		await createSession(db, 1);
		expect(await storedIds(db)).toHaveLength(2);
	});
});

describe('findUserBySession', () => {
	it('知らないトークンでは引けない', async () => {
		const db = await setup();
		expect(await findUserBySession(db, 'a'.repeat(64))).toBeNull();
	});

	it('期限が切れたら引けない', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-18T00:00:01.000Z'));
		expect(await findUserBySession(db, token)).toBeNull();
	});

	it('退会したユーザーでは引けない', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		await db.prepare('UPDATE users SET deleted_at = ? WHERE id = 1').bind('2026-09-12').run();
		expect(await findUserBySession(db, token)).toBeNull();
	});

	it('半分を過ぎるまでは置き換えない', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T11:00:00.000Z')); // 3.5日にわずかに足りない
		expect((await findUserBySession(db, token))?.renewedToken).toBeNull();
	});

	it('半分を過ぎたら置き換える', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z')); // 3.5日を過ぎた
		const renewed = (await findUserBySession(db, token))?.renewedToken;
		expect(renewed).toEqual(expect.any(String));
	});

	it('置き換えた新しいトークンで引ける', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z'));
		const renewed = (await findUserBySession(db, token))!.renewedToken!;
		expect((await findUserBySession(db, renewed))?.id).toBe(1);
	});
});

describe('盗まれたトークンの検知', () => {
	/** 置き換えたあと、猶予の内に古いトークンが届く。並行リクエストで普通に起きる */
	it('猶予の内なら古いトークンも通す', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z'));
		await findUserBySession(db, token);

		vi.advanceTimersByTime(29 * 1000);
		expect((await findUserBySession(db, token))?.id).toBe(1);
	});

	it('猶予を過ぎた古いトークンは通さない', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z'));
		await findUserBySession(db, token);

		vi.advanceTimersByTime(31 * 1000);
		expect(await findUserBySession(db, token)).toBeNull();
	});

	it('猶予を過ぎたら、その系列をまとめて失効させる', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z'));
		const renewed = (await findUserBySession(db, token))!.renewedToken!;

		vi.advanceTimersByTime(31 * 1000);
		await findUserBySession(db, token);
		expect(await findUserBySession(db, renewed)).toBeNull();
	});

	it('他の端末の系列は巻き込まない', async () => {
		const db = await setup();
		const stolen = await createSession(db, 1);
		const other = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z'));
		await findUserBySession(db, stolen);

		vi.advanceTimersByTime(31 * 1000);
		await findUserBySession(db, stolen);
		expect((await findUserBySession(db, other))?.id).toBe(1);
	});
});

describe('ログアウト', () => {
	it('消したトークンでは引けない', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		await deleteSession(db, token);
		expect(await findUserBySession(db, token)).toBeNull();
	});

	it('置き換え前のトークンも一緒に消える', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		vi.setSystemTime(new Date('2026-09-14T13:00:00.000Z'));
		const renewed = (await findUserBySession(db, token))!.renewedToken!;

		await deleteSession(db, renewed);
		expect(await findUserBySession(db, token)).toBeNull();
	});

	it('他の端末は残る', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		const other = await createSession(db, 1);
		await deleteSession(db, token);
		expect((await findUserBySession(db, other))?.id).toBe(1);
	});

	it('全端末ログアウトは全部消す', async () => {
		const db = await setup();
		const token = await createSession(db, 1);
		const other = await createSession(db, 1);
		await deleteUserSessions(db, 1);
		expect([await findUserBySession(db, token), await findUserBySession(db, other)]).toEqual([
			null,
			null
		]);
	});

	it('全端末ログアウトは他のユーザーを消さない', async () => {
		const db = await setup();
		const mine = await createSession(db, 1);
		const theirs = await createSession(db, 2);
		await deleteUserSessions(db, 1);
		expect([await findUserBySession(db, mine), (await findUserBySession(db, theirs))?.id]).toEqual([
			null,
			2
		]);
	});
});
