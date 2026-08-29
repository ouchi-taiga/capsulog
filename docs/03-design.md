# カプセログ 設計書

作成日: 2026-08-30

---

## 1. この文書の範囲

**どう作るか**を書く。何を作るかは要件定義に置く。

対象はフェーズ1の全体と、フェーズ2以降のデータモデル。

---

## 2. システム構成

```text
[収集バッチ] --日次--> [D1] <--- [Workers] <--HTTP-- [SPA]
     |                                                 |
  各メーカー                                    Cloudflare Pages
GitHub Actions
```

| レイヤ | 技術 | 選定理由 |
|---|---|---|
| フロント | SvelteKit（adapter-static） | SPAとして配信。PWA化が容易 |
| ホスティング | Cloudflare Pages | 無料枠が実質無制限、帯域無料 |
| API | Cloudflare Workers（Rust → WASM） | 無料枠 10万req/日 |
| DB | Cloudflare D1（SQLite互換） | 無料枠 5GB |
| 収集バッチ | Python / GitHub Actions | 日次実行。実行時間の上限が緩い |
| 画像（フェーズ2〜） | Cloudflare R2 | 無料10GB、egress課金ゼロ |

全て無料枠に収まる。

Vercel を選ばない理由は、Rust バックエンドを動かせないことと、無料枠の帯域が100GB/月で超過時の課金が急激なこと。

### 収集バッチを Workers で動かさない理由

**実行時間が収まらない。** 奇譚クラブは商品ごとに詳細ページを取りに行くため、953件を1秒間隔で回すと約16分かかる。3社で約35分。Workers の Cron は CPU 時間に上限があり、この処理は入らない。

**HTMLパースが2社ある。** 奇譚クラブとバンダイは正規表現ベースのHTMLパースになる。WASM 上の Rust でこれをやると、パーサのクレート選定が WASM 制約に縛られる。Python なら標準ライブラリで足りる。

### Workers（Rust/WASM）の制約

API 側には以下の制約がかかる。

- 全ての Rust クレートが動くわけではない
- `tokio` のフル機能は使えない
- ネイティブTLSは不可

API は D1 にクエリして JSON を返すだけのため、これらの制約に当たらない。

---

## 3. データモデル

### 3.1 マイグレーション

wrangler で管理する。D1 は適用済みマイグレーションを自前のテーブルで持ち、wrangler がそれを見ている。他のツールを併用すると二重管理になる。

**sqlx は使えない。** D1 は HTTP バインディング経由でしか触れず、接続文字列が存在しない。WASM 上では sqlx のドライバもコンパイルが通らない。

### 3.2 テーブル定義

```sql
CREATE TABLE makers (
  id           INTEGER PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,   -- 'kitan' | 'tarlin' | 'bandai'
  name         TEXT NOT NULL,
  official_url TEXT NOT NULL,
  source_type  TEXT NOT NULL           -- 'wp_api' | 'json_api' | 'html'
);

CREATE TABLE products (
  id                 INTEGER PRIMARY KEY,
  maker_id           INTEGER NOT NULL REFERENCES makers(id),
  source_id          TEXT    NOT NULL,   -- メーカー側の識別子
  name               TEXT    NOT NULL,
  price              INTEGER,            -- 円
  release_year_month TEXT,               -- 'YYYY-MM'
  release_period     TEXT,               -- 'early' | 'mid' | 'late'
  release_tbd        INTEGER NOT NULL DEFAULT 0,
  total_variants     INTEGER,
  official_url       TEXT    NOT NULL,
  image_url          TEXT,               -- 保持のみ。フェーズ1では配信しない
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

### 3.3 各カラムの根拠

**`release_year_month` は月単位まで。日単位のカラムを持たない。**
全メーカーが月単位までしか公開していない。日単位のカラムを作ると、存在しない精度を持っているかのような誤解を生む。

**`release_year_month` は NULL を許容する。**
ターリンには発売月が記載されていない商品が存在する（8%）。取得できないものを 0000-00 などで埋めない。

**`release_period` は奇譚クラブ専用ではない。**
上旬・中旬・下旬の3値。奇譚クラブのみが提供するが、他社が将来提供する可能性を残す。

**`release_tbd` はバンダイの「未定」表現を保持する。**
バンダイは「2027年1月未定」と、月は決まっているが日が未定であることを明示的にデータ化している。将来月ほど未定になる。

**`total_variants` を正とする。**
奇譚クラブのラインナップ要素には説明画像が混ざり、実件数が全何種を上回ることがある。表示・集計はこの値を使う。

**`variants` を最初から分離する。**
フェーズ2の「全5種中3種所持」がこのテーブルに依存する。フェーズ1の時点では奇譚クラブのみ埋まる。

**`content_hash` で差分を検知する。**
名前・価格・発売月・全何種を連結してハッシュ化し、変化がなければ更新しない。

### 3.4 フェーズ2以降のテーブル

```sql
CREATE TABLE users (
  id         INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE user_watches (       -- 「気になる」
  user_id    INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE user_collections (   -- 所持記録
  user_id    INTEGER NOT NULL REFERENCES users(id),
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  quantity   INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, variant_id)
);
```

ダブりは `quantity - 1` で表す。所持数を持たせるほうが、所持フラグとダブり数を別に持つより整合性が崩れにくい。

---

## 4. データソース

### 4.1 3社の比較

| | 奇譚クラブ | ターリン | バンダイ |
|---|---|---|---|
| 総件数 | 953 | 616 | 500 |
| 一覧の取得 | WP REST API | JSON API | HTML 1ページ |
| 詳細の取得 | HTMLパース必要 | JSON API | HTMLパース必要 |
| 発売月 | ⭕ 旬まで取れる | △ 8%欠損 | ⭕ 未定フラグ付き |
| 価格 | ⭕ | ⭕ | ⭕ |
| 全何種 | ⭕ | ⭕ | ⭕ |
| ラインナップ名 | ⭕ **3社で唯一** | ❌ | ❌ |
| 初回取得の所要 | 約16分 | 約10分 | 約9分 |

**ラインナップ名が取れるのは奇譚クラブのみ。** フェーズ2のコレクション管理は、当面この1社の商品でしか成立しない。

### 4.2 奇譚クラブ

一覧APIの本文は宣伝文で、発売月も価格も含まない。2段構えになる。

| 段 | 取得元 | 得られるもの |
|---|---|---|
| 1 | `/wp-json/wp/v2/products` | 商品ID、商品名、詳細URL |
| 2 | 各詳細ページのHTML | 発売月、旬、価格、全何種、ラインナップ名 |

件数は `X-WP-Total` ヘッダで取る。

詳細ページの構造:

```html
<dl class="c-productDetail__detail-item">
  <dt>発売日</dt><dd>2026年9月下旬</dd>
</dl>
<dl class="c-productDetail__detail-item">
  <dt>価格</dt><dd><span>1回500円</span>　<span>全5種</span></dd>
</dl>
<p class="c-productDetail__pickup-text">グミッツェル グレープ</p>
```

`pickup-text` にはラインナップ以外の説明画像が混ざる。`total_variants` の件数だけ先頭から採用する。

2010年の商品まで同一構造で、16年分にわたって崩れがない。

### 4.3 ターリン

Strapi の公開APIで、認証なしで全件返る。ページングは `_limit` と `_start`（Strapi v3 系の記法）。

| 用途 | エンドポイント |
|---|---|
| 件数 | `/api/products/count` |
| 一覧 | `/api/products?_limit=100&_start=0` |
| 詳細 | `/api/products/{id}` |

一覧には価格と発売月が含まれないため、詳細を個別に取る。

| 項目 | 取得元 |
|---|---|
| 価格 | `price`（数値） |
| 全何種 | `kind`（数値） |
| 発売月 | `description` の先頭行「2026年6月発売」 |

`kind` はフィールド名からは種類数と読み取れないが、詳細ページの「4種類」と一致する。

**発売月が記載されていない商品が約8%ある。** 詳細ページにも記載がなく、データ側の欠落。NULLとして扱う。

**サーバが中間証明書を配信していない。** リーフ証明書を2枚返す設定で、ブラウザは補完するがHTTPクライアントからは検証に失敗する。GlobalSign RSA OV SSL CA 2018 を CA バンドルに追加して解決する。

### 4.4 バンダイ

`/products/` が500件を1ページで返す。APIはないが、カード構造が完全に規則的。

```html
<a href="detail.php?jan_code=4570118186522000" class="c-card__link">
  <p class="c-card__name">aespa ミニチュアパッケージチャーム</p>
  <span class="c-card__price--main">400</span>
</a>
```

発売月と全何種は一覧になく、詳細ページから取る。

```html
<dl class="pg-detailDefinition">
  <dt class="pg-detailDefinition__title">発売時期</dt>
  <dd class="pg-detailDefinition__detail --releaseDate">2027年1月未定</dd>
</dl>
```

**一覧の月フィルタは機能しない。** `?sale_year=2026&sale_month=09` と `10` で結果が完全に同一（レスポンス520,361バイトで固定）。クライアントサイド処理のため、全500件を取得してから自前で絞り込む。

商品の識別子はJANコード。

### 4.5 対象外

| メーカー | 理由 |
|---|---|
| タカラトミーアーツ | 一覧が横カルーセルでページングがない。sitemap経由の全件巡回が必要 |
| Qualia | 一覧に日付・価格がなく全件巡回が必要 |
| ケンエレファント | 商品専用の投稿種別がなく、情報がニュース記事本文に埋没 |
| SO-TA | 公式ドメインを特定できない |

タカラトミーアーツと Qualia はフェーズ1完了後に追加する。

---

## 5. 収集バッチ

### 5.1 動作

| 項目 | 仕様 |
|---|---|
| 実行環境 | GitHub Actions |
| 実行頻度 | 日次1回 |
| リクエスト間隔 | 1秒以上 |
| User-Agent | サービス名と連絡先を含む識別可能なもの |
| 失敗時 | ログを残して次のソースへ継続。1社の失敗で全体を止めない |
| 差分検知 | `content_hash` を比較し、変化があるものだけ更新 |

### 5.2 初回と日次の使い分け

初回は3社で約35分かかる。日次実行では一覧を取得して未知の `source_id` と `content_hash` が変わったものだけ詳細を取りに行く。発売情報は月単位で動くため、これで十分。

### 5.3 出典の保持

`official_url` は必須。表示時に必ず公式ページへリンクする。これは利便性ではなく、出典明示という法的要請による。

### 5.4 破損の検知

外部サイトの仕様変更で収集は必ず壊れる。壊れ方は3種類あり、危険度が違う。

| 壊れ方 | 検知 | 危険度 |
|---|---|---|
| APIが404や500を返す | 例外で即わかる | 低 |
| HTMLのクラス名が変わる | パース結果が空になる | 中 |
| **構造が微妙に変わり、間違った値が入る** | **何もしなければ気づかない** | **高** |

3つ目が本当の脅威。エラーは出ず、DBに嘘のデータが静かに溜まる。これを防ぐため、**取り込む前に2段階で検証し、通らなければそのメーカーの取り込みを中止する。**

**件数の異常検知**

前回の取得件数と比べて **30%以上減っていたら中止**する。DBは上書きしない。

一覧の取得自体が壊れると件数が激減するため、最も安く効く防御になる。

**値の妥当性検証**

| 項目 | 妥当な範囲 |
|---|---|
| 価格 | 100〜2,000円 |
| 全何種 | 1〜30 |
| 発売月 | 過去5年〜未来2年 |
| 商品名 | 空でない |

範囲外が **全体の10%を超えたら中止**する。単発の外れ値はメーカー側の実データの揺れなので許容する。

`release_year_month` の欠損はターリンで常時8%発生するため、欠損そのものは異常として扱わない。ただし**欠損率が前回から20ポイント以上悪化した場合は中止**する。

**中止したときの動作**

| 対象 | 動作 |
|---|---|
| そのメーカー | 取り込みを中止し、DBは前回の状態を保つ |
| 他のメーカー | 通常どおり続行する |
| ログ | 中止の理由と、判定に使った数値を記録する |

通知はフェーズ1では作らない。開発者自身が毎日使う前提のため、ログを見れば足りる。ユーザーが増えてから追加する。

### 5.5 検証スクリプトによる早期発見

`probe/` の3スクリプトは、収集バッチとは独立に各メーカーの構造が生きているかを確認する。バッチ本体と実装を共有しないため、**バッチ側のバグと外部サイトの変更を切り分けられる。**

収集が中止されたとき、まずこれを走らせて原因がどちら側かを判断する。

---

## 6. 法的な扱い

### 6.1 各社の規約

3社とも自動取得を禁じる条項はない。ただし全社が掲載内容の複製・転載を禁じている。

| メーカー | 規約 | 自動取得の禁止 | 複製・転載 |
|---|---|---|---|
| バンダイ | ウェブサイトご利用条件 / 著作権・商標について | なし | 「私的使用その他法令等によって認められる範囲を超えて、掲載情報を使用（複製、改変、掲示、頒布、ライセンス、販売、出版等を含む）することは、バンダイの事前許諾がない限り、禁止」 |
| 奇譚クラブ | プライバシーポリシーのみ | なし | 記載なし |
| ターリン | プライバシーポリシーのみ | なし | 記載なし |
| タカラトミーアーツ | — | なし | 「無断で転用、転載することはご遠慮ください」 |

robots.txt はバンダイとターリンが404（存在しない）、奇譚クラブは `Disallow: /wp-admin/` のみで商品ページは対象外。

**robots.txt が無いことは許可の明示ではない。** 存在しない場合も1秒間隔を守る。

### 6.2 遵守事項

- 収集するのは事実情報のみ（商品名・発売月・価格・全何種・メーカー名）。これらに著作権は発生しない
- **商品説明文を保存・表示しない。** バンダイの複製禁止条項に該当する
- 画像を自前で配信しない
- 必ず出典を明示し、公式ページへリンクする
- X（旧Twitter）の投稿は機械収集しない。利用規約がAPI外の自動収集を明確に禁じており、著作権法以前に契約違反となる

著作権法30条の4により、情報解析目的の収集は適法。

**禁じられているのは取得ではなく複製・転載である。** 事実情報だけを扱う限り抵触しないが、説明文や画像に手を出した時点で抵触する。この線が適法性の境界になる。

規約は予告なく変更される。バンダイは「事前に予告することなく、この利用条件を変更することがあります」と明記している。**規約とrobots.txtは半年に1度再確認する。**

### 6.3 画像の扱い

商品画像は全社とも版権キャラクター画像であり、再配布はライセンス上の問題が生じる。

| 案 | 判断 |
|---|---|
| ダウンロードして自サーバーから配信 | ❌ 転載にあたる |
| 公式画像URLを直接参照（ホットリンク） | △ 相手サーバーに負荷をかける。フェーズ1では避ける |
| **画像を出さず、商品名と公式リンクのみ** | ⭕ **フェーズ1はこれ** |
| ユーザー投稿写真 | ⭕ フェーズ2以降。投稿者に著作権があり、規約で利用許諾を得られる |
| メーカーに個別許諾を取る | 理想だが実績のない段階では難しい |

`image_url` はDBに保持するが、フェーズ1では配信しない。フェーズ2でユーザー投稿写真に移行する。

---

## 7. フェーズ3のマッチング

```text
ユーザーAのダブり ∩ ユーザーBの欲しい物  かつ
ユーザーBのダブり ∩ ユーザーAの欲しい物
→ 双方向マッチ成立
```

`user_collections` の `quantity >= 2` がダブり、`user_watches` が欲しい物。SQLのJOINで求まる。

片方向のみのマッチを「譲れる相手」として出すかは、双方向マッチの数を見てから決める。

マッチングまでを作り、その先は作らない。連絡手段は外部のSNSに委ねる。チャット、評価、本人確認、配送・決済の仲介は作らない。個人運営で当事者間トラブルを裁くのは不可能なため、裁かない構造にする。
