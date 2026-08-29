# api

フロントに商品データを返す。Cloudflare Workers 上で WASM として動く。

## 実行

```bash
pnpm exec wrangler dev      # ローカル起動
pnpm exec wrangler deploy
```

## ドキュメント

```bash
cargo doc --no-deps --open
```

rustdoc の形式で書く。
公開項目にドキュメントが無いと `cargo check` が警告する。

説明は見出しを付けずに書く。
一行目を要約にして、続きは空行のあとに書く。

```rust
/// D1 まで届いているかを確認する。
///
/// 疎通の確認だけを行う。
/// スキーマには触れない。
///
/// # Errors
///
/// `DB` のバインディングが無いとき、またはクエリが失敗したときに返す。
async fn health(env: &Env) -> Result<Response> {
```

見出しは必要なときだけ使う。
使うのは次の4つで、いずれも `#` から始める。

| 見出し | 書くとき |
|---|---|
| `# Errors` | `Result` を返す関数。どんなときに `Err` になるか |
| `# Panics` | パニックしうる関数。その条件 |
| `# Examples` | 使い方が自明でないとき |
| `# Safety` | `unsafe` な関数。呼ぶ側が守る前提 |

引数の説明は、名前から読み取れないときだけ本文に書く。
節を設けて全ての引数を並べない。

コード例は動かせない。
`worker::Env` が要るため、Workers のランタイム外では実行できない。
例を書くときは `ignore` を付ける。

## エンドポイント

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/products` | 商品一覧。発売月・メーカー・キーワード・価格で絞り込む |
| GET | `/products/:id` | 商品詳細。ラインナップを含む |
| GET | `/makers` | メーカー一覧 |

## D1 の扱い

D1 は HTTP バインディング経由でのみ触れる。接続文字列が無いため sqlx は使えない。SQL は文字列で書く。

```rust
let db = env.d1("DB")?;
let result = db.prepare("SELECT * FROM products WHERE maker_id = ?1")
    .bind(&[maker_id.into()])?
    .all()
    .await?;
```

## 守ること

商品説明文と画像は DB に無い。返すのは事実情報のみで、`official_url` を必ず含める。出典明示のため。
