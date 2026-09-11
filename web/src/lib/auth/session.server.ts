import type { User } from './types';

export const SESSION_COOKIE = 'session';

/** セッションの寿命 */
const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/* 置き換えたあと、古いトークンを受け付ける時間。
   並行するリクエストが差し替え前のまま届くため、即座に切ると本人が失効する */
const GRACE_MS = 30 * 1000;

export type SessionUser = User & {
	/** 差し替える新しいトークン。置き換えが要らなければ null */
	renewedToken: string | null;
};

type SessionRow = User & {
	sessionId: string;
	familyId: string;
	expiresAt: string;
	rotatedAt: string | null;
};

const SELECT_SESSION = `
	SELECT s.id AS sessionId, s.family_id AS familyId,
	       s.expires_at AS expiresAt, s.rotated_at AS rotatedAt,
	       u.id, u.email,
	       u.display_name         AS displayName,
	       u.x_handle             AS xHandle,
	       u.agreed_terms_version AS agreedTermsVersion
	FROM sessions s JOIN users u ON u.id = s.user_id
	WHERE s.id = ? AND u.deleted_at IS NULL
`;

/**
 * Cookie の付け方。
 * httpOnly で JS から読めなくし、sameSite で他サイトからのリクエストに乗せない
 */
export function sessionCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax' as const,
		maxAge: LIFETIME_MS / 1000
	};
}

/** 推測できないトークンを作る。256bit を16進で返す */
function createToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** トークンを DB に入れる形にする。生の値は Cookie にだけ持つ */
async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function insertSession(
	db: D1Database,
	token: string,
	familyId: string,
	userId: number,
	now: Date
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO sessions (id, family_id, user_id, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(
			await hashToken(token),
			familyId,
			userId,
			new Date(now.getTime() + LIFETIME_MS).toISOString(),
			now.toISOString()
		)
		.run();
}

/**
 * ログインしてセッションを作り、Cookie に入れるトークンを返す。
 * ついでに、そのユーザーの期限切れを消す。掃除のためのスケジューラを持たないため
 */
export async function createSession(db: D1Database, userId: number): Promise<string> {
	const now = new Date();
	const token = createToken();
	await db
		.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?')
		.bind(userId, now.toISOString())
		.run();
	await insertSession(db, token, crypto.randomUUID(), userId, now);
	return token;
}

/**
 * トークンからユーザーを引く。
 * 置き換え済みのトークンが猶予を過ぎて使われたら盗まれたと見なし、その系列を失効させる
 */
export async function findUserBySession(
	db: D1Database,
	token: string
): Promise<SessionUser | null> {
	const row = await db
		.prepare(SELECT_SESSION)
		.bind(await hashToken(token))
		.first<SessionRow>();
	if (!row) return null;

	const now = new Date();
	if (new Date(row.expiresAt) <= now) return null;

	if (row.rotatedAt) {
		// 猶予の内なら、差し替えが届かなかっただけ。そのまま通す
		if (now.getTime() - new Date(row.rotatedAt).getTime() <= GRACE_MS) {
			return { ...toUser(row), renewedToken: null };
		}
		await deleteFamily(db, row.familyId);
		return null;
	}

	// 半分を過ぎたら置き換える。毎回書くと書き込みが増える
	const remaining = new Date(row.expiresAt).getTime() - now.getTime();
	if (remaining > LIFETIME_MS / 2) return { ...toUser(row), renewedToken: null };

	const renewedToken = createToken();
	await db
		.prepare('UPDATE sessions SET rotated_at = ? WHERE id = ?')
		.bind(now.toISOString(), row.sessionId)
		.run();
	await insertSession(db, renewedToken, row.familyId, row.id, now);
	return { ...toUser(row), renewedToken };
}

function toUser(row: SessionRow): User {
	return {
		id: row.id,
		email: row.email,
		displayName: row.displayName,
		xHandle: row.xHandle,
		agreedTermsVersion: row.agreedTermsVersion
	};
}

/** ログアウト。その系列だけを消す。他の端末は残る */
export async function deleteSession(db: D1Database, token: string): Promise<void> {
	const row = await db
		.prepare('SELECT family_id AS familyId FROM sessions WHERE id = ?')
		.bind(await hashToken(token))
		.first<{ familyId: string }>();
	if (row) await deleteFamily(db, row.familyId);
}

async function deleteFamily(db: D1Database, familyId: string): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE family_id = ?').bind(familyId).run();
}

/** 全端末からログアウト。パスワード変更と退会でも呼ぶ */
export async function deleteUserSessions(db: D1Database, userId: number): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}
