"""Qualia。一覧ページから詳細をパースする。詳細は dt/dd で構造化されている。"""

import re

import net

from . import MONTH, PRICE, TOTAL, needs_detail, product, to_ym, txt

CODE = "qualia"
COUNT_GATE = False  # 日次は先頭ページしか見ないため、DB の全件数と比較できない
BASE = "https://www.qualia-45.jp"
VIEW = re.compile(r"/product/view/(\d+)")


def _list_ids(full, limit):
    """商品 ID の一覧を集める。

    先頭ページは product.html。全件モードのみ index/{page} を新規が尽きるまでたどる。
    """
    ids = []
    seen = set()
    page = 1
    # 60 はページングが壊れて止まらなくなったときの保険
    while page <= 60:
        url = f"{BASE}/product.html" if page == 1 else f"{BASE}/product/index/{page}?target=product"
        h = net.get_text(url)
        chunk = [int(m.group(1)) for m in VIEW.finditer(h)]
        # 既知の ID しか出なくなったら最終ページまで見た
        new = [i for i in chunk if i not in seen]
        if not new:
            break
        seen.update(new)
        ids.extend(new)
        if limit and len(ids) >= limit:
            return ids[:limit]
        if not full:
            break
        page += 1
    return ids


def _parse_detail(h):
    """詳細ページの dt/dd から商品名・発売日・価格・全何種を取り出す。"""
    d = {}
    for m in re.finditer(r"(?is)<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", h):
        d[txt(m.group(1))] = txt(m.group(2))
    rel, pr = d.get("発売日", ""), d.get("価格", "")
    mm, mp, mt = MONTH.search(rel), PRICE.search(pr), TOTAL.search(pr)
    return {
        "name": d.get("商品名"),
        "ym": to_ym(mm),
        "precision": "month" if mm else None,
        "raw": rel or None,
        "price": int(mp.group(1).replace(",", "")) if mp else None,
        "total": int(mt.group(1)) if mt else None,
    }


def fetch(existing, full, limit, log):
    """商品を取得する。

    Returns:
        (正規化した商品のリスト, 一覧に載っていた件数)
    """
    ids = _list_ids(full, limit)
    log.info(f"一覧 listed={len(ids)}")
    out = []
    for i in ids:
        sid = str(i)
        if not needs_detail(sid, existing, full):
            continue
        p = _parse_detail(net.get_text(f"{BASE}/product/view/{i}"))
        if not p["name"]:
            log.warning(f"商品名が取れない id={i}")
            continue
        out.append(product(sid, p.pop("name"), f"{BASE}/product/view/{i}", **p))
    return out, len(ids)
