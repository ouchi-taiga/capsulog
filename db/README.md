# db

D1 のスキーマとマイグレーション。

## マイグレーション

wrangler で管理する。D1 が適用済みの記録を自前で持つため、他のツールを併用しない。

```bash
npx wrangler d1 migrations create capsulog <名前>
npx wrangler d1 migrations apply capsulog --local
npx wrangler d1 migrations apply capsulog --remote
```

`migrations/` に SQL ファイルを置く。適用済みのファイルは編集しない。変更するときは新しいマイグレーションを追加する。

## テーブル

| テーブル | 内容 |
|---|---|
| `makers` | メーカー |
| `products` | 商品 |
| `variants` | ラインナップの各種類 |

## 設計上の決まり

**日単位の発売日カラムを作らない。** メーカーが月単位までしか公開していない。存在しない精度を持っているように見せない。

**`release_year_month` は NULL を許容する。** ターリンには発売月が記載されていない商品がある。取得できないものを埋めない。

**`total_variants` を正とする。** 奇譚クラブのラインナップには説明画像が混ざり、実件数が全何種を上回ることがある。

**`variants` を最初から分ける。** フェーズ2の「全5種中3種所持」がこのテーブルに依存する。

商品説明文と画像を保存するカラムを作らない。
