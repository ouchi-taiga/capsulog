"""メーカーからデータを収集して D1 に取り込む。日次で1回実行する。

1社が失敗しても他社は続行する。触るのは origin = 'batch' の行だけ。
書き込み先は環境変数 D1_TARGET で選ぶ（既定はローカル）。
"""

import argparse
import datetime
import hashlib
import logging
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import d1
from makers import JST, kitan, parade, qualia, takaratomy, tarlin
from validate import check

logger = logging.getLogger("batch")

MAKERS = {m.CODE: m for m in (kitan, tarlin, takaratomy, qualia, parade)}
# D1 の REST API は1文あたりのバインドパラメータが100個まで
PARAM_LIMIT = 100
CHUNK = 25

# products の列。この並びで upsert のパラメータを組む
COLS = (
    "maker_id",
    "origin",
    "source_id",
    "name",
    "price",
    "release_year_month",
    "release_precision",
    "release_detail",
    "release_tbd",
    "release_raw",
    "total_variants",
    "official_url",
    "image_url",
    "content_hash",
    "fetched_at",
    "created_at",
    "updated_at",
)
# 衝突キーと created_at 以外は取得値で上書きする
_KEEP = {"maker_id", "origin", "source_id", "created_at"}
_UPDATES = ", ".join(f"{c}=excluded.{c}" for c in COLS if c not in _KEEP)
UPSERT = (
    f"INSERT INTO products ({', '.join(COLS)}) VALUES {{values}} "
    f"ON CONFLICT (maker_id, source_id) DO UPDATE SET {_UPDATES} "
    "WHERE products.origin = 'batch'"
)


def setup_logging():
    """stdout と batch/logs/ の2箇所に流す。

    stdout は GitHub Actions のジョブログ用。ファイルは手元での実行を残す用で、
    info.log に全部、error.log に WARNING 以上だけを追記する。
    時刻は発売月の扱いと同じく日本時間で出す。
    """
    logging.Formatter.converter = lambda *_: datetime.datetime.now(JST).timetuple()
    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s %(filename)s:%(lineno)d %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)

    handlers = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_dir / "info.log", encoding="utf-8"),
        logging.FileHandler(log_dir / "error.log", encoding="utf-8"),
    ]
    handlers[2].setLevel(logging.WARNING)
    for h in handlers:
        h.setFormatter(fmt)
    logging.basicConfig(level=logging.INFO, handlers=handlers)


class MakerLog(logging.LoggerAdapter):
    """メーカーコードを行頭に付けるロガー。makers と validate にこれを渡す。"""

    def process(self, msg, kwargs):
        return f"[{self.extra['maker']}] {msg}", kwargs


def content_hash(p) -> str:
    """商品の内容からハッシュを作る。前回と一致すれば書き込みを省ける。"""
    parts = [p["name"], p["price"], p["ym"], p["precision"], p["detail"], p["tbd"], p["total"]]
    parts += p["variants"]
    return hashlib.sha256("|".join(str(x) for x in parts).encode()).hexdigest()


def chunks(xs, n=CHUNK):
    """リストを n 件ずつに割る。SQL のプレースホルダ数を抑えるため。"""
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def upsert_products(db, maker_id, items, now):
    """商品をまとめて upsert する。

    UNIQUE (maker_id, source_id) に当たったら更新する。何度実行しても結果は同じ。
    created_at は更新しないため、初回の値が残る。
    """
    for chunk in chunks(items, PARAM_LIMIT // len(COLS)):
        row = "(" + ",".join(["?"] * len(COLS)) + ")"
        params = []
        for p in chunk:
            params += [
                maker_id,
                "batch",
                p["source_id"],
                p["name"],
                p["price"],
                p["ym"],
                p["precision"],
                p["detail"],
                p["tbd"],
                p["raw"],
                p["total"],
                p["official_url"],
                p["image_url"],
                p["hash"],
                now,
                now,
                now,
            ]
        db.query(UPSERT.format(values=",".join([row] * len(chunk))), params)


def replace_variants(db, maker_id, items):
    """ラインナップを商品ごとに入れ替える。

    順序や名前の部分的な変化を追うより、消して入れ直すほうが単純で確実。
    variants が空になった商品も、古い行を残さないため削除の対象にする。
    """
    for chunk in chunks(items):
        # variants は product_id で繋がる。upsert 後の id をまず引く。
        # origin を絞るのは、運営の手入力分の variants を消さないため
        ph = ",".join(["?"] * len(chunk))
        rows = db.query(
            f"SELECT id, source_id FROM products "
            f"WHERE maker_id = ? AND origin = 'batch' AND source_id IN ({ph})",
            [maker_id] + [p["source_id"] for p in chunk],
        )
        pid = {r["source_id"]: r["id"] for r in rows}
        ids = [pid[p["source_id"]] for p in chunk if p["source_id"] in pid]
        if not ids:
            continue
        db.query(f"DELETE FROM variants WHERE product_id IN ({','.join(['?'] * len(ids))})", ids)
        rows = [
            (pid[p["source_id"]], name, i, 1 if "シークレット" in name else 0)
            for p in chunk
            if p["source_id"] in pid
            for i, name in enumerate(p["variants"])
        ]
        for sub in chunks(rows, PARAM_LIMIT // 4):
            db.query(
                "INSERT INTO variants (product_id, name, display_order, is_secret) VALUES "
                + ",".join(["(?,?,?,?)"] * len(sub)),
                [v for r in sub for v in r],
            )


def run_maker(db, code, maker_id, args, log):
    """1社分の収集を行う。

    流れ:
        1. DB から前回の取り込み結果を読む
        2. メーカーから取得する
        3. 検証に通らなければ、何も書かずに終える。前回のデータが残る
        4. 内容が前回と変わった商品だけを書き込む

    Returns:
        検証か取得に失敗したら False。
    """
    t0 = time.monotonic()
    maker = MAKERS[code]

    # 前回の取り込み結果。差分判定と、検証ゲートの「前回値」の両方に使う
    rows = db.query(
        "SELECT source_id, content_hash, release_year_month FROM products "
        "WHERE maker_id = ? AND origin = 'batch'",
        [maker_id],
    )
    existing = {r["source_id"]: r for r in rows}
    prev_missing = (
        sum(1 for r in rows if r["release_year_month"] is None) / len(rows) if rows else None
    )

    # existing を渡すのは、日次モードで新規と発売間近の商品だけ詳細を取りに行かせるため
    items, listed_n = maker.fetch(existing, args.full, args.limit, log)
    # --limit は一覧を切り詰めるため、件数の減少とは区別がつかない
    count_gate = maker.COUNT_GATE and not args.limit
    reason = check(items, listed_n, len(existing), prev_missing, args.full, count_gate, log)
    if reason:
        log.error(f"中止 {reason}")
        return False

    # 内容のハッシュが前回と同じなら書かない。ほとんどの日は変更が数件で済む
    for p in items:
        p["hash"] = content_hash(p)
    changed = [
        p for p in items if existing.get(p["source_id"], {}).get("content_hash") != p["hash"]
    ]

    if changed and not args.dry_run:
        now = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
        upsert_products(db, maker_id, changed, now)
        replace_variants(db, maker_id, changed)

    missing = sum(1 for p in items if p["ym"] is None)
    log.info(
        f"完了 listed={listed_n} fetched={len(items)} changed={len(changed)} "
        f"missing_ym={missing} elapsed={time.monotonic() - t0:.0f}s"
        + (" dry_run=1" if args.dry_run else "")
    )
    return True


def main():
    """全メーカーを順に収集する。1社でも失敗があれば終了コード1で終わる。"""
    ap = argparse.ArgumentParser()
    ap.add_argument("--maker", choices=sorted(MAKERS), help="1社だけ実行する")
    ap.add_argument("--full", action="store_true", help="全件の詳細を取り直す")
    ap.add_argument("--dry-run", action="store_true", help="D1 に書き込まない")
    ap.add_argument("--limit", type=int, help="詳細取得の上限。検証用")
    args = ap.parse_args()

    setup_logging()
    logger.info(
        f"開始 mode={'full' if args.full else 'daily'} "
        f"target={os.environ.get('D1_TARGET', 'local')}"
    )
    db = d1.connect(str(Path(__file__).parent.parent))
    maker_ids = {r["code"]: r["id"] for r in db.query("SELECT id, code FROM makers")}

    ok = True
    for code in [args.maker] if args.maker else sorted(MAKERS):
        log = MakerLog(logger, {"maker": code})
        try:
            if not run_maker(db, code, maker_ids[code], args, log):
                ok = False
        except Exception:  # 1社の失敗で全体を止めない
            log.exception("失敗")
            ok = False
    logger.info(f"終了 ok={int(ok)}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
