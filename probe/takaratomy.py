import re, html, time, urllib.request, collections

UA = "capsulog-probe/0.1 (contact: ouchi@fintechsys.co.jp)"
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=25) as f:
        return f.read().decode("utf-8", "replace")
def txt(x): return " ".join(html.unescape(re.sub(r"(?is)<[^>]+>", "", x)).split())

BASE = "https://www.takaratomy-arts.co.jp"
# 月別カレンダー。<h3><em>9</em>月<em>7</em>日週発売</h3> の週見出しごとに商品が並ぶ
GROUP = re.compile(r'(?is)<div class="group[^"]*">\s*<h3[^>]*>(.*?)</h3>(.*?)(?=<div class="group|</main|$)')
ITEM  = re.compile(r'(?is)item\.html\?n=([A-Z0-9]+)".*?<p class="black">(.*?)</p>')
PRICE = re.compile(r"([\d,]+)\s*円")
MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月")
TOTAL = re.compile(r"全\s*(\d+)\s*種")
WEEK  = re.compile(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日週")

def parse_detail(h):
    body = txt(h)
    mp, mm, mt = PRICE.search(body), MONTH.search(re.search(r"発売時期[:：][^■]*", body).group(0) if re.search(r"発売時期[:：][^■]*", body) else ""), TOTAL.search(body)
    return dict(
        ym=f"{mm.group(1)}-{int(mm.group(2)):02d}" if mm else None,
        price=int(mp.group(1).replace(",", "")) if mp else None,
        total=int(mt.group(1)) if mt else None,
    )

if __name__ == "__main__":
    ym = "202606"
    cal = get(f"{BASE}/items/gacha/calendar/?ym={ym}")
    items = []
    for g in GROUP.finditer(cal):
        head = txt(g.group(1))
        w = WEEK.search(head)
        week = f"{int(w.group(1)):02d}-{int(w.group(2)):02d}日週" if w else head
        for m in ITEM.finditer(g.group(2)):
            items.append((m.group(1), txt(m.group(2)), week))
    print(f"{ym} の掲載数: {len(items)}\n")

    rows, miss = [], collections.Counter()
    for pid, name, week in items[:12]:
        time.sleep(1)
        try:
            p = parse_detail(get(f"{BASE}/items/item.html?n={pid}"))
        except Exception as e:
            print(f"  ERROR {pid}: {e}"); continue
        p["id"], p["name"], p["week"] = pid, name, week
        rows.append(p)
        for k in ("name", "ym", "price", "total"):
            if p.get(k) in (None, ""): miss[k] += 1
        print(f"  {p['ym']}  {week:10}  {str(p['price'])+'円':>6}  全{p['total']}種   {name[:30]}")
    print("\n欠損:", dict(miss) or "なし")
    print("価格:", dict(collections.Counter(r["price"] for r in rows)))
