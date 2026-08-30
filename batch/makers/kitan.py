"""奇譚クラブ。WP REST API で一覧、詳細ページをパースする。"""

import json
import re
import urllib.error

import net

from . import PRICE, TOTAL, needs_detail, product, to_ym, txt

CODE = "kitan"
COUNT_GATE = True  # 一覧に全件が載るため、件数の減少で壊れを検知できる
BASE = "https://kitan.jp"
# 奇譚クラブだけ旬（上旬・中旬・下旬）まで書くため、共通の MONTH は使わない
MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(上旬|中旬|下旬)?")
PERIOD = {"上旬": "early", "中旬": "mid", "下旬": "late"}


def _list_all(limit):
    """WP REST API で全商品の ID と詳細 URL を集める。100件ずつページングする。"""
    items, page = [], 1
    while True:
        try:
            body = net.get_text(
                f"{BASE}/wp-json/wp/v2/products?per_page=100&page={page}&_fields=id,link"
            )
        except urllib.error.HTTPError as e:
            # 総件数が100の倍数だと最終ページが満杯になり、次のページで初めて終端がわかる。
            # WP は範囲外ページに 400 を返すため、2ページ目以降の 400 は終端として扱う
            if e.code == 400 and page > 1:
                break
            raise
        chunk = json.loads(body)
        if not chunk:
            break
        items.extend(chunk)
        if limit and len(items) >= limit:
            return items[:limit]
        if len(chunk) < 100:
            break
        page += 1
    return items


def _parse_detail(h):
    """詳細ページの HTML から発売日・価格・全何種・ラインナップを取り出す。

    対象の構造。2010年の商品まで同じで、16年間崩れていない::

        <dl class="c-productDetail__detail-item"><dt>発売日</dt><dd>2026年9月下旬</dd></dl>
        <dl class="c-productDetail__detail-item"><dt>価格</dt><dd>1回500円 全5種</dd></dl>
        <p class="c-productDetail__pickup-text">グミッツェル グレープ</p>
    """
    d = {}
    for m in re.finditer(r'(?is)<dl class="c-productDetail__detail-item">(.*?)</dl>', h):
        dt = re.search(r"(?is)<dt>(.*?)</dt>", m.group(1))
        dd = re.search(r"(?is)<dd>(.*?)</dd>", m.group(1))
        if dt and dd:
            d[txt(dt.group(1))] = txt(dd.group(1))
    rel, pr = d.get("発売日", ""), d.get("価格", "")
    mm, mp, mt = MONTH.search(rel), PRICE.search(pr), TOTAL.search(pr)
    total = int(mt.group(1)) if mt else None
    names = [
        txt(m.group(1))
        for m in re.finditer(r'(?is)<p class="c-productDetail__pickup-text">(.*?)</p>', h)
    ]
    # ラインナップには説明画像が混ざるため、全何種の数だけ先頭から採用する
    variants = names[:total] if total else names
    return {
        "name": d.get("商品名"),
        "ym": to_ym(mm),
        "precision": "period" if mm and mm.group(3) else ("month" if mm else None),
        "detail": PERIOD.get(mm.group(3)) if mm and mm.group(3) else None,
        "raw": rel or None,
        "price": int(mp.group(1).replace(",", "")) if mp else None,
        "total": total,
        "variants": variants,
    }


def fetch(existing, full, limit, log):
    """商品を取得する。

    Returns:
        (正規化した商品のリスト, 一覧に載っていた件数)
    """
    items = _list_all(limit)
    log.info(f"一覧 listed={len(items)}")
    out = []
    for it in items:
        sid = str(it["id"])
        if not needs_detail(sid, existing, full):
            continue
        p = _parse_detail(net.get_text(it["link"]))
        if not p["name"]:
            log.warning(f"商品名が取れない url={it['link']}")
            continue
        out.append(product(sid, p.pop("name"), it["link"], **p))
    return out, len(items)
