# web

発売カレンダーの画面と API。SvelteKit で書き、Cloudflare Workers 上で動く。

## 実行

```bash
pnpm dev      # ローカル起動。localhost:5173
pnpm build
pnpm deploy
```

`pnpm dev` に `--host` を付けている。
付けないと IPv6 だけで待ち受け、Dev Container のポート転送から届かない。

## 画面

| 画面 | 内容 |
|---|---|
| 一覧 | 発売月でグルーピング。メーカー・キーワード・価格で絞り込む |
| 詳細 | 全何種、価格、ラインナップ、公式サイトへのリンク |

## 表示の決まり

| 項目 | 扱い |
|---|---|
| 発売日 | 月まで。日は表示しない |
| 発売月が不明 | 「発売月未定」として確定分と混ぜない |
| バンダイの未定 | 月を表示し、日が未定であることを併記する |
| ラインナップ | 奇譚クラブの商品のみ表示される |
| 商品画像 | 表示しない |
| 商品説明文 | 表示しない |

公式サイトへのリンクは必須。出典明示を兼ねるため省略しない。

スマホでの利用が主。モバイル表示を優先する。

## API

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/products` | 商品一覧。発売月・メーカー・キーワード・価格で絞り込む |
| GET | `/api/products/[id]` | 商品詳細。ラインナップを含む |
| GET | `/api/makers` | メーカー一覧 |

商品説明文と画像は DB に無い。
返すのは事実情報のみで、`official_url` を必ず含める。出典明示のため。

## D1 の扱い

server route から `platform.env.DB` で触れる。
接続文字列が無いため汎用の ORM は使えない。SQL は文字列で書く。

```ts
const { results } = await platform.env.DB
  .prepare('SELECT * FROM products WHERE maker_id = ?')
  .bind(makerId)
  .all();
```

型は `src/lib/types.ts` に置き、画面と server route で共有する。
