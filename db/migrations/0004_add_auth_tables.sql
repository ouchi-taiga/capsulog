-- Migration number: 0004 	 2026-09-10
-- 認証。Google の OAuth とメール+パスワードの両方を受ける

CREATE TABLE users (
  id                   INTEGER PRIMARY KEY,
  email                TEXT UNIQUE,   -- 確認済みのものだけ。退会時に NULL
  display_name         TEXT,
  x_handle             TEXT,          -- X のユーザー名。@ は含めない
  ical_token           TEXT UNIQUE,   -- 購読 URL に載せる。漏れたら再発行する
  agreed_terms_version TEXT,          -- 同意した規約の版
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT           -- 退会時刻。NULL なら在籍中
);

-- provider に CHECK を付けない。方式が増えたときに行を足すだけで済ませる
CREATE TABLE user_identities (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT    NOT NULL,   -- 'google' | 'password'
  provider_user_id TEXT    NOT NULL,   -- google は sub、password はメールアドレス
  password_hash    TEXT,               -- password のときだけ入る
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  UNIQUE (provider, provider_user_id)
);

-- id はトークンの SHA-256。DB が漏れても、そのままでは使えない
CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  family_id  TEXT    NOT NULL,   -- 同じログインから派生した系列。盗難時はこの単位で失効させる
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  rotated_at TEXT,               -- 置き換えた時刻。猶予の間だけ古い方も受け付ける
  created_at TEXT    NOT NULL
);

CREATE TABLE auth_tokens (
  id         TEXT    PRIMARY KEY,   -- ランダムなトークン
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT    NOT NULL CHECK (purpose IN ('email_verify', 'password_reset')),
  expires_at TEXT    NOT NULL,
  used_at    TEXT,                  -- 使ったら入れる。1回で使い切る
  created_at TEXT    NOT NULL
);

CREATE INDEX idx_identities_user   ON user_identities(user_id);
CREATE INDEX idx_sessions_user     ON sessions(user_id);
CREATE INDEX idx_sessions_family   ON sessions(family_id);
CREATE INDEX idx_auth_tokens_user  ON auth_tokens(user_id);
