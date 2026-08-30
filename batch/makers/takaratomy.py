"""タカラトミーアーツ。月別カレンダーで一覧を取り、詳細ページをパースする。

カレンダーは「9月7日週発売」という週単位の見出しで商品を並べている。
再販が混ざるため、詳細の発売時期がカレンダーの月と食い違うことがある。
一部の商品は特設ページへリダイレクトされ、項目が取れない。NULL のまま登録する。
"""

import datetime
import re

import net

from . import JST, MONTH, PRICE, TOTAL, needs_detail, product, to_ym, txt

CODE = "takaratomy"
COUNT_GATE = False  # カレンダーの窓しか見えず、全件数と比較できない
BASE = "https://www.takaratomy-arts.co.jp"
GROUP = re.compile(
    r'(?is)<div class="group[^"]*">\s*<h3[^>]*>(.*?)</h3>(.*?)(?=<div class="group|</main|$)'
)
ITEM = re.compile(r'(?is)item\.html\?n=([A-Z0-9]+)".*?<p class="black">(.*?)</p>')
WEEK = re.compile(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日週")


def _months(full):
    """取得する月のリストを 'YYYYMM' で返す。

    日次は2ヶ月前から、全件モードは12ヶ月前から、いずれも4ヶ月先まで。
    """
    today = datetime.datetime.now(JST).date().replace(day=1)
    back = 12 if full else 2
    months = []
    for off in range(-back, 5):
        y, m = today.year, today.month + off
        # 12月をまたいだオフセットを年に繰り上げる
        y, m = y + (m - 1) // 12, (m - 1) % 12 + 1
        months.append(f"{y}{m:02d}")
    return months


def _parse_detail(h):
    """詳細ページの HTML から発売時期・価格・全何種を取り出す。

    特設ページへリダイレクトされた商品は何も取れず、全て None になる。
    """
    body = txt(h)
    rel = re.search(r"発売時期[:：]\s*([^\s■]+)", body)
    mm = MONTH.search(rel.group(1)) if rel else None
    mp = PRICE.search(body)
    mt = TOTAL.search(body)
    return {
        "ym": to_ym(mm),
        "raw": rel.group(1) if rel else None,
        "price": int(mp.group(1).replace(",", "")) if mp else None,
        "total": int(mt.group(1)) if mt else None,
    }


def fetch(existing, full, limit, log):
    """商品を取得する。月別カレンダーを巡回し、週の見出しごとに商品を拾う。

    カレンダーの構造。週見出しの h3 に、その週の商品リンクが続く::

        <div class="group isSet">
          <h3 class="black"><em>9</em>月<em>7</em>日週発売</h3>
          <a href="../../item.html?n=Y093210">…<p class="black">商品名</p></a>…

    同じ商品が複数月に載る（再販）ときは、後の月で上書きする。

    Returns:
        (正規化した商品のリスト, カレンダーに載っていた件数)
    """
    found = {}
    for ym_key in _months(full):
        cal = net.get_text(f"{BASE}/items/gacha/calendar/?ym={ym_key}")
        cal_ym = f"{ym_key[:4]}-{ym_key[4:]}"
        n = 0
        for g in GROUP.finditer(cal):
            w = WEEK.search(txt(g.group(1)))
            week = f"{int(w.group(1)):02d}-{int(w.group(2)):02d}" if w else None
            for m in ITEM.finditer(g.group(2)):
                found[m.group(1)] = (txt(m.group(2)), cal_ym, week, txt(g.group(1)))
                n += 1
        log.info(f"カレンダー ym={cal_ym} listed={n}")
        if limit and len(found) >= limit:
            break

    items = list(found.items())[:limit] if limit else list(found.items())
    out = []
    for sid, (name, cal_ym, week, head) in items:
        if not needs_detail(sid, existing, full):
            continue
        p = _parse_detail(net.get_text(f"{BASE}/items/item.html?n={sid}"))
        ym = p["ym"] or cal_ym
        # 週が取れて、かつ詳細の月とカレンダーの月が一致するときだけ週として扱う。
        # 食い違いは再販で、週はその再出荷のものだから
        is_week = week is not None and ym == cal_ym
        out.append(
            product(
                sid,
                name,
                f"{BASE}/items/item.html?n={sid}",
                ym=ym,
                precision="week" if is_week else "month",
                detail=week if is_week else None,
                raw=" / ".join(x for x in [p["raw"], head] if x) or None,
                price=p["price"],
                total=p["total"],
            )
        )
    return out, len(found)
