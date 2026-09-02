"""パレード。カプセルトイのカテゴリ一覧をたどり、詳細ページをパースする。

プライズも扱う会社のため、一覧はカテゴリで絞る。
発売時期は「2026年8月下旬より順次発売予定」の形で、旬まで取れる。
"""

import re
import urllib.error

import net

from . import MONTH, TOTAL, needs_detail, product, to_ym, txt

CODE = "parade"
COUNT_GATE = True  # カテゴリの全ページをたどるため、DB の全件数と比較できる
BASE = "https://www.parade-inc.net"
CATEGORY = f"{BASE}/products/products-category/capsule-toy"
# 一覧は発売の新しい順。1件から slug と発売時期を同時に拾う
ITEM = re.compile(
    rf'(?is)<a href="{re.escape(BASE)}/products/([^"/]+)" class="item".*?'
    r'<div class="sale-date[^"]*">(.*?)</div>'
)
TITLE = re.compile(r'(?is)<h1 class="product-title">(.*?)</h1>')
RELEASE = re.compile(r'(?is)<p class="product-release-month[^"]*">(.*?)</p>')
NOTES = re.compile(r'(?is)<ul class="product-notes">(.*?)</ul>')
MONTH_ONLY = re.compile(r"(\d{1,2})\s*月")
PERIOD = {"上旬": "early", "中旬": "mid", "下旬": "late"}
PERIOD_PATTERN = re.compile("|".join(PERIOD))
# 注意書きは「種類：全7種（内シークレット1種）」「価格：500円」の形で並ぶ。
# 全何種は「種類：」を伴わないこともあるため、共通の TOTAL で拾う
NOTE_PRICE = re.compile(r"価格[:：]\s*([\d,]+)\s*円")


def _list_items(limit):
    """カプセルトイのカテゴリをページングでたどり、スラッグと発売時期を集める。

    最終ページの次は 404 を返す。これがページングの終わりの合図になる。
    """
    items = []
    seen = set()
    page = 1
    # 60 はページングが壊れて止まらなくなったときの保険
    while page <= 60:
        url = CATEGORY if page == 1 else f"{CATEGORY}/page/{page}"
        try:
            h = net.get_text(url)
        except urllib.error.HTTPError as e:
            if e.code == 404 and page > 1:
                break
            raise
        found = [(s, txt(d)) for s, d in ITEM.findall(h) if s not in seen]
        if not found:
            break
        seen.update(s for s, _ in found)
        items.extend(found)
        if limit and len(items) >= limit:
            return items[:limit]
        page += 1
    return items


def _fill_years(items):
    """年なしの発売時期に年を補い、{スラッグ: 'YYYY-MM'} を返す。

    一覧は発売の新しい順に並び、年は要所の商品にしか書かれていない。
    年なしの商品は、前後にある年付きの商品に挟まれた期間のどこかに入る。
    その範囲に収まる年を選ぶ。並びには乱れがあるため、順に足し引きはしない。
    古い商品を未来に置いてしまわないよう、年の根拠は年付きの商品だけに置く。
    """
    months = [MONTH_ONLY.search(raw) for _, raw in items]
    known = [MONTH.search(raw) for _, raw in items]

    years = {}
    for i, (slug, _) in enumerate(items):
        if known[i]:
            years[slug] = f"{int(known[i].group(1))}-{int(known[i].group(2)):02d}"
            continue
        if not months[i]:
            continue
        month = int(months[i].group(1))
        # 新しい側の年を上限、古い側の年を下限にする
        newer = next((known[j] for j in range(i - 1, -1, -1) if known[j]), None)
        older = next((known[j] for j in range(i + 1, len(items)) if known[j]), None)
        upper = int(newer.group(1)) if newer else None
        lower = int(older.group(1)) if older else None
        if upper is None and lower is None:
            continue
        # 上限側から見て、その年月が新しい側を追い越さない年を選ぶ
        year = upper if upper is not None else lower
        if newer and (year, month) > (int(newer.group(1)), int(newer.group(2))):
            year -= 1
        if lower is not None and year < lower:
            year = lower
        years[slug] = f"{year}-{month:02d}"
    return years


def _parse_detail(h):
    """詳細ページから商品名・発売時期・価格・全何種を取り出す。

    注意書きの構造::

        <p class="product-release-month">2026年8月下旬より順次発売予定</p>
        <h1 class="product-title">映画ちいかわ たべものいっぱいマスコット</h1>
        <ul class="product-notes">
          <li>カプセルトイ</li>
          <li>種類：全7種（内シークレット1種）</li>
          <li>価格：500円</li>
        </ul>
    """
    title, release, notes = TITLE.search(h), RELEASE.search(h), NOTES.search(h)
    rel = txt(release.group(1)) if release else ""
    note = txt(notes.group(1)) if notes else ""
    mp, mt = NOTE_PRICE.search(note), TOTAL.search(note)
    period = PERIOD_PATTERN.search(rel)
    return {
        "name": txt(title.group(1)) if title else None,
        "ym": to_ym(MONTH.search(rel)),
        "period": PERIOD[period.group()] if period else None,
        "raw": rel or None,
        "price": int(mp.group(1).replace(",", "")) if mp else None,
        "total": int(mt.group(1)) if mt else None,
    }


def fetch(existing, full, limit, log):
    """商品を取得する。

    Returns:
        (正規化した商品のリスト, 一覧に載っていた件数)
    """
    items = _list_items(limit)
    years = _fill_years(items)
    log.info(f"一覧 listed={len(items)}")
    out = []
    for sid, _ in items:
        if not needs_detail(sid, existing, full):
            continue
        p = _parse_detail(net.get_text(f"{BASE}/products/{sid}"))
        if not p["name"]:
            log.warning(f"商品名が取れない slug={sid}")
            continue
        # 詳細に年が無い商品は、一覧の並びから復元した年月を使う
        ym = p["ym"] or years.get(sid)
        period = p["period"]
        out.append(
            product(
                sid,
                p["name"],
                f"{BASE}/products/{sid}",
                ym=ym,
                precision=("period" if period else "month") if ym else None,
                detail=period if ym else None,
                raw=p["raw"],
                price=p["price"],
                total=p["total"],
            )
        )
    return out, len(items)
