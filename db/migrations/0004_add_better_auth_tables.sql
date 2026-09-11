-- Migration number: 0004 	 2026-09-12
-- 認証。Better Auth が読み書きする。列の構成は Better Auth が決める

CREATE TABLE users (
  id                 INTEGER NOT NULL PRIMARY KEY,
  name               TEXT    NOT NULL,
  email              TEXT    NOT NULL UNIQUE,
  emailVerified      INTEGER NOT NULL,   -- 確認が済むまでログインさせない
  image              TEXT,
  createdAt          DATE    NOT NULL,
  updatedAt          DATE    NOT NULL,
  xHandle            TEXT,               -- X のユーザー名。@ は含めない
  icalToken          TEXT,               -- 購読 URL に載せる。漏れたら再発行する
  agreedTermsVersion TEXT,               -- 同意した規約の版
  deletedAt          DATE                -- 退会時刻。Better Auth は見ない
);

CREATE TABLE sessions (
  id        INTEGER NOT NULL PRIMARY KEY,
  expiresAt DATE    NOT NULL,
  token     TEXT    NOT NULL UNIQUE,
  createdAt DATE    NOT NULL,
  updatedAt DATE    NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- ログイン手段。1人が Google とパスワードの両方を持てる
CREATE TABLE user_identities (
  id                    INTEGER NOT NULL PRIMARY KEY,
  accountId             TEXT    NOT NULL,
  providerId            TEXT    NOT NULL,   -- 'google' | 'credential'
  userId                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accessToken           TEXT,               -- 暗号化して入る
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  DATE,
  refreshTokenExpiresAt DATE,
  scope                 TEXT,
  password              TEXT,               -- credential のときだけ入る
  createdAt             DATE    NOT NULL,
  updatedAt             DATE    NOT NULL
);

-- メール確認とパスワードリセット。identifier はハッシュで入る
CREATE TABLE auth_tokens (
  id         INTEGER NOT NULL PRIMARY KEY,
  identifier TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  expiresAt  DATE    NOT NULL,
  createdAt  DATE    NOT NULL,
  updatedAt  DATE    NOT NULL
);

CREATE INDEX sessions_userId_idx          ON sessions(userId);
CREATE INDEX user_identities_userId_idx   ON user_identities(userId);
CREATE INDEX auth_tokens_identifier_idx   ON auth_tokens(identifier);
