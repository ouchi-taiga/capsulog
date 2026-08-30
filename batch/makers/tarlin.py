"""ターリン。Strapi の公開 API のみで完結する。"""

import json

import net

from . import MONTH, needs_detail, product, to_ym

CODE = "tarlin"
COUNT_GATE = True  # 一覧に全件が載るため、件数の減少で壊れを検知できる
BASE = "https://tarlin-capsule.jp"


def _list_ids(limit):
    """商品 ID の一覧を集める。件数は count API、一覧は100件ずつページングする。"""
    total = int(net.get_text(f"{BASE}/api/products/count"))
    ids, start = [], 0
    while start < total:
        chunk = json.loads(net.get_text(f"{BASE}/api/products?_limit=100&_start={start}"))
        if not chunk:
            break
        ids.extend(x["id"] for x in chunk)
        if limit and len(ids) >= limit:
            return ids[:limit], total
        start += 100
    return ids, total


def fetch(existing, full, limit, log):
    """商品を取得する。発売月は詳細 JSON の説明文から正規表現で取り出す。

    Returns:
        (正規化した商品のリスト, 一覧に載っていた件数)
    """
    ids, total = _list_ids(limit)
    log.info(f"一覧 listed={len(ids)} count={total}")
    out = []
    for i in ids:
        sid = str(i)
        if not needs_detail(sid, existing, full):
            continue
        d = json.loads(net.get_text(f"{BASE}/api/products/{i}"))
        name = d.get("name")
        if not name:
            log.warning(f"商品名が取れない id={i}")
            continue
        desc = d.get("description") or ""
        m = MONTH.search(desc)
        out.append(
            product(
                sid,
                name,
                f"{BASE}/product/{i}",
                ym=to_ym(m),
                precision="month" if m else None,
                raw=m.group(0) if m else None,
                price=d.get("price"),
                total=d.get("kind"),
            )
        )
    return out, len(ids)
