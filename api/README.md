# api

フロントに商品データを返す。Cloudflare Workers 上で WASM として動く。

## 実行

```bash
npx wrangler dev      # ローカル起動
npx wrangler deploy
```

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
