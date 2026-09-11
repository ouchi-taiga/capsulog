# db

D1 のスキーマとマイグレーション。

## マイグレーション

wrangler で管理する。D1 が適用済みの記録を自前で持つため、他のツールを併用しない。

```bash
pnpm --dir ../web exec wrangler d1 migrations create capsulog <名前>
pnpm --dir ../web exec wrangler d1 migrations apply capsulog --local
pnpm --dir ../web exec wrangler d1 migrations apply capsulog --remote
```

`migrations/` に SQL ファイルを置く。適用済みのファイルは編集しない。
変更するときは新しいマイグレーションを追加する。

## ローカル DB の確認

```bash
cd web
pnpm exec wrangler d1 migrations apply capsulog --local   # 初回
pnpm exec wrangler d1 execute capsulog --local --command "SELECT * FROM makers"
```

実体は `web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` の SQLite ファイル。
sqlite3 で直接開ける。

汎用の ORM は使えない。D1 は Workers のバインディング経由でしか触れず、接続文字列が存在しない。

## テーブル

| テーブル | 日本語 | 内容 |
|---|---|---|
| `makers` | メーカー | 収集対象のメーカー |
| `products` | 商品 | 商品。「○○シリーズ 全5種」の単位 |
| `variants` | ラインナップ | 全5種の1種1種。タイプA、シークレットなど |
| `users` | ユーザー | 登録したユーザー |
| `user_identities` | 認証情報 | ログイン手段。1人が複数持てる |
| `sessions` | セッション | ログイン中の印 |
| `auth_tokens` | 確認トークン | メール確認とパスワードリセット |

下の4つは Better Auth が読み書きする。マスタとは分けて考える。

マスタに書き込むのは収集バッチと運営だけ。**ユーザー入力はマスタに入れない。**

フェーズ2以降で `match_entries`（譲・求）、`user_collections`（所持記録）が加わる。

## テーブル定義

```sql
CREATE TABLE makers (
  id           INTEGER PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,   -- 'kitan' | 'tarlin' | 'takaratomy' | 'qualia' | 'bandai'
  name         TEXT NOT NULL,
  official_url TEXT NOT NULL,
  source_type  TEXT NOT NULL           -- 'wp_api' | 'json_api' | 'html' | 'manual'
);

CREATE TABLE products (
  id                 INTEGER PRIMARY KEY,
  maker_id           INTEGER NOT NULL REFERENCES makers(id),
  origin             TEXT    NOT NULL DEFAULT 'batch',  -- 'batch' | 'manual'
  source_id          TEXT    NOT NULL,   -- メーカー側の識別子
  name               TEXT    NOT NULL,
  price              INTEGER,            -- 円
  release_year_month TEXT,               -- 'YYYY-MM'
  release_precision  TEXT,               -- 'month' | 'period' | 'week'
  release_detail     TEXT,               -- 粒度に応じた値
  release_tbd        INTEGER NOT NULL DEFAULT 0,
  release_raw        TEXT,               -- 発売時期の生値
  total_variants     INTEGER,
  official_url       TEXT    NOT NULL,
  image_url          TEXT,               -- 保持のみ。配信しない
  content_hash       TEXT    NOT NULL,   -- 差分検知用
  fetched_at         TEXT    NOT NULL,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  UNIQUE (maker_id, source_id)
);

CREATE TABLE variants (
  id            INTEGER PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  display_order INTEGER NOT NULL,
  is_secret     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_release ON products(release_year_month, maker_id);
CREATE INDEX idx_products_maker   ON products(maker_id);
CREATE INDEX idx_variants_product ON variants(product_id);
```

## 各カラムの根拠

**日単位の発売日カラムを作らない。**
日単位まで公開するメーカーがない。最も細かいタカラトミーアーツでも週まで。
日単位のカラムを作ると、存在しない精度を持っているかのような誤解を生む。

**`release_year_month` は NULL を許容する。**
ターリンには発売月が記載されていない商品が存在する。取得できないものを 0000-00 などで埋めない。

**発売時期は粒度と値を分けて持つ。**
メーカーによって公開の細かさが違う。
列を分けると、メーカーが増えるたびに列が増える。

| `release_precision` | `release_detail` | 出す社 |
|---|---|---|
| `month` | NULL | ターリン、Qualia |
| `period` | `early` \| `mid` \| `late` | 奇譚クラブ |
| `week` | 週の起点日 `MM-DD` | タカラトミーアーツ。「9月7日週発売」の表記から取る |

新しい粒度が出てきても、`release_precision` に値を足すだけで済む。

**`release_tbd` は「月は決まっているが日が未定」を表す。**
「2027年1月未定」のような表現を落とさずに持つ。

**`release_raw` は発売時期の生値を残す。**
「2026年9月下旬」のような元の文字列。
パースが誤ったとき、正規化後の値だけでは原因を追えない。

**`origin` は収集分と手入力分を区別する。**
バンダイは規約により自動収集できない。運営が手で入れる場合は `manual` になる。
バッチは `batch` の行しか触らない。

**`source_id` はメーカーごとに意味が違う。**
奇譚クラブは URL スラッグ、ターリンと Qualia は商品ID、タカラトミーアーツは品番、バンダイは JAN コードが入る。
JAN 専用のカラムは作らない。埋まるのが1社だけになるため。

**`total_variants` を正とする。**
奇譚クラブのラインナップ要素には説明画像が混ざり、実件数が全何種を上回ることがある。
表示・集計はこの値を使う。

**`variants` を最初から分ける。**
フェーズ2の「全5種中3種所持」がこのテーブルに依存する。フェーズ1では奇譚クラブのみ埋まる。

**`content_hash` で差分を検知する。**
名前・価格・発売月・全何種を連結してハッシュ化し、変化がなければ更新しない。

## 持たないもの

| 項目 | 理由 |
|---|---|
| 商品説明文 | 事実情報のみを収集する。各社が転載を禁じている |
| 画像の実体 | 版権物であり再配布できない |
| 日単位の発売日 | メーカーが公開していない |
| 規約の確認日 | DB ではなくチェックリストで管理する |

### 画像について

**商品画像は全社とも版権物。** メーカーの著作権に加え、キャラクターの権利者の許諾が乗る。
メーカーが許可しても、それだけでは足りない場合がある。

`image_url` は URL の保持のみで、ダウンロードも配信もしない。
将来メーカーから許諾を得たときに使えるようにしておく。

他のサービスが表示していることは、適法の根拠にならない。
データを取得させてもらう立場でもあり、収集自体を止められるリスクを負わない。

画像がない分の情報量は、ラインナップ名の表示で補う。
「全5種」の中身を出せるのは奇譚クラブだけであり、競合にない要素でもある。

## 認証のテーブル

**Better Auth が読み書きする。** 列の構成は Better Auth が決める。
テーブル名だけ `modelName` で既存の呼び方に寄せている。

```sql
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
  deletedAt          DATE                -- 退会時刻。弾くのはアプリ側
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

CREATE TABLE auth_tokens (
  id         INTEGER NOT NULL PRIMARY KEY,
  identifier TEXT    NOT NULL,   -- ハッシュで入る
  value      TEXT    NOT NULL,
  expiresAt  DATE    NOT NULL,
  createdAt  DATE    NOT NULL,
  updatedAt  DATE    NOT NULL
);

CREATE INDEX sessions_userId_idx        ON sessions(userId);
CREATE INDEX user_identities_userId_idx ON user_identities(userId);
CREATE INDEX auth_tokens_identifier_idx ON auth_tokens(identifier);
```

列を足すときは `web/src/lib/auth/auth.server.ts` の `additionalFields` に書き、
`better-auth generate` で出た SQL を新しいマイグレーションにする。
手で列を足すと、Better Auth が知らない列になる。

**独自の列は4つ。** `xHandle` `icalToken` `agreedTermsVersion` `deletedAt`。
Better Auth はこれらを読み書きするだけで、意味は解釈しない。

**ログイン手段を `user_identities` に分けて持つ。**
1人が Google とパスワードの両方を持てる。`providerId` で区別する。

**同じメールなら同じユーザーに繋ぐ。**
Google とパスワードで別々のアカウントができると、棚が消えたように見える。
繋ぐのは確認済みのメールのときだけ。未確認だと他人のアドレスを名乗れる。

**`emailVerified` が 0 の間はログインさせない。**
他人のアドレスで登録したアカウントを動かさないため。
確認が済むまでの行も `users` に入る。仮登録を別のテーブルには分けない。

**セッションのトークンは平文で入る。** DB が漏れれば、そのままログインに使える。
Cookie 側は署名され、`httpOnly` と `secure` が付く。

**確認とリセットのトークンはハッシュで入る。**
`storeIdentifier` を `hashed` にしている。

**退会は `deletedAt` を入れる論理削除にする。**
フェーズ2の相互評価は、相手が退会しても残らなければ意味がない。

**ログインを弾くのは `hooks.server.ts`。** 参照する側のクエリも `deletedAt IS NULL` を必ず含める。

**期限切れの行は溜まる。** `cleanup/` の日次バッチが、期限切れのセッションとトークン、
確認されないまま24時間を過ぎた仮登録を消す。

## フェーズ2以降のテーブル

```sql
CREATE TABLE match_entries (      -- 譲・求
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  kind            TEXT    NOT NULL,   -- 'offer' | 'want'
  product_id      INTEGER REFERENCES products(id),
  variant_id      INTEGER REFERENCES variants(id),
  free_text       TEXT,               -- マスタに無い商品の記述
  normalized_text TEXT,               -- 曖昧一致用の正規化文字列
  photo_key       TEXT,               -- R2 のキー
  created_at      TEXT    NOT NULL
);

CREATE TABLE user_collections (   -- 所持記録
  user_id    INTEGER NOT NULL REFERENCES users(id),
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  quantity   INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, variant_id)
);
```

**`match_entries` はマスタ参照かフリーテキストのどちらかが埋まる。**
ユーザー入力がマスタに昇格することはない。
荒れても被害はその出品1件に閉じる。

曖昧一致は `normalized_text` で行い、候補の提示までに留める。確定するのは人。

ダブりは `quantity - 1` で表す。
所持数を持たせるほうが、所持フラグとダブり数を別に持つより整合性が崩れにくい。
