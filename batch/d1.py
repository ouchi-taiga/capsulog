"""D1 への読み書き。

接続先は環境変数 D1_TARGET で選ぶ。

- `local`（既定）: miniflare の SQLite ファイルを直接触る
- `remote`: Cloudflare の REST API 経由。CLOUDFLARE_API_TOKEN が要る

既定をローカルにしているのは、手元での実行が誤って本番に書かないようにするため。
"""

import glob
import json
import os
import sqlite3
import urllib.request

ACCOUNT_ID = "394b46f6291810407ce73d6465f59cd3"
DATABASE_ID = "5f496d82-bf27-4a0b-8482-8b5447c356d5"
LOCAL_GLOB = "web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite"


def connect(repo_root: str):
    """D1_TARGET に応じたクライアントを返す。

    Returns:
        query(sql, params) -> list[dict] を持つオブジェクト。
    """
    target = os.environ.get("D1_TARGET", "local")
    if target == "remote":
        return RemoteD1()
    if target == "local":
        return LocalD1(repo_root)
    raise RuntimeError(f"D1_TARGET は local か remote: {target}")


class RemoteD1:
    """本番の D1。Cloudflare の REST API で1文ずつ実行する。"""

    def __init__(self):
        token = os.environ.get("CLOUDFLARE_API_TOKEN")
        if not token:
            raise RuntimeError("CLOUDFLARE_API_TOKEN が未設定")
        self._url = (
            f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}"
            f"/d1/database/{DATABASE_ID}/query"
        )
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        """SQL を実行し、結果行を dict のリストで返す。失敗は例外にする。"""
        body = json.dumps({"sql": sql, "params": params or []}).encode()
        req = urllib.request.Request(self._url, data=body, headers=self._headers)
        with urllib.request.urlopen(req, timeout=60) as f:
            res = json.loads(f.read())
        if not res.get("success"):
            raise RuntimeError(f"D1 error: {res.get('errors')}")
        return res["result"][0].get("results", [])


class LocalD1:
    """開発用の D1。wrangler がローカルに作る SQLite を直接開く。

    先に web で `wrangler d1 migrations apply capsulog --local` を実行して
    ファイルを作っておく必要がある。
    """

    def __init__(self, repo_root: str):
        # metadata.sqlite は miniflare の管理ファイルで、D1 の実体ではない
        paths = [p for p in glob.glob(os.path.join(repo_root, LOCAL_GLOB)) if "metadata" not in p]
        if not paths:
            raise RuntimeError(
                "ローカル D1 が見つからない。web で migrations apply --local を先に行う"
            )
        self._con = sqlite3.connect(paths[0])
        self._con.row_factory = sqlite3.Row

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        """SQL を実行し、結果行を dict のリストで返す。実行ごとにコミットする。"""
        cur = self._con.execute(sql, params or [])
        rows = [dict(r) for r in cur.fetchall()]
        self._con.commit()
        return rows
