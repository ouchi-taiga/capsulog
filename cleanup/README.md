# cleanup

期限が切れた行を D1 から消す。日次で1回実行する。

収集とは別に動かす。消すものが増えたら `targets/` に足す。

## 実行

```bash
uv run cleanup/main.py             # 全対象
uv run cleanup/main.py --dry-run   # 数えるだけで消さない
```

書き込み先は環境変数 `D1_TARGET` で選ぶ。収集と同じ。

| 値 | 先 |
|---|---|
| `local`（既定） | 手元の D1。`web/.wrangler/` の SQLite |
| `remote` | 本番の D1。`CLOUDFLARE_API_TOKEN` が要る |

## 日次実行

`.github/workflows/cleanup.yml` が毎朝4時（JST）に本番から消す。
収集の1時間前に置いて、ログが混ざらないようにしている。

手動で回すときは GitHub の Actions タブから workflow_dispatch で実行する。
`dry-run` を有効にすると件数だけ出る。

## 対象

`targets/` に1対象1ファイルで置く。`__init__.py` の `ORDER` が実行順。

| 対象 | 消すもの |
|---|---|
| `pending_users` | 確認されないまま期限が切れた仮登録 |
| `auth_tokens` | 期限が切れたトークンと、使い終わったトークン |
| `sessions` | 期限が切れたセッション |

**仮登録を先に消す。** 関連する行が CASCADE で一緒に消え、後続の対象が減る。

仮登録は `users.email` が NULL の行。確認が済むとメールが入る。
有効な確認トークンが残っているものは、まだ待っている途中なので消さない。

セッションはログインのたびにそのユーザーの分を消しているが、
二度と来ないユーザーの行は残る。それをここで回収する。

## 対象を足す

`targets/` にモジュールを作り、`ORDER` に並べる。

```python
NAME = "何を消すか"


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。dry_run なら数えるだけ"""
```

1つが失敗しても他の対象は続行する。消せなかった分は翌日に持ち越す。

## コードの書き方

`batch/` と同じ。標準ライブラリのみ。docstring は PEP 257 に従う。

D1 への接続とログの設定は `shared/` にある。収集と同じものを使う。

## lint

```bash
ruff check .
ruff format .
```
