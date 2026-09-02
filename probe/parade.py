import re, html, time, urllib.request, collections

UA = "capsulog-probe/0.1 (contact: ouchi@fintechsys.co.jp)"
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=25) as f:
        return f.read().decode("utf-8", "replace")
def txt(x): return " ".join(html.unescape(re.sub(r"(?is)<[^>]+>", "", x)).split())

BASE = "https://www.parade-inc.net"
CATEGORY = f"{BASE}/products/products-category/capsule-toy"
ITEM = re.compile(r'<a href="https://www\.parade-inc\.net/products/(c[^"/]+)" class="item"')
TITLE = re.compile(r'(?is)<h1 class="product-title">(.*?)</h1>')
RELEASE = re.compile(r'(?is)<p class="product-release-month[^"]*">(.*?)</p>')
NOTES = re.compile(r'(?is)<ul class="product-notes">(.*?)</ul>')
MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月")
PERIOD = re.compile(r"(上旬|中旬|下旬)")
PRICE = re.compile(r"価格：\s*([\d,]+)\s*円")
TOTAL = re.compile(r"種類：\s*全\s*(\d+)\s*種")
SECRET = re.compile(r"シークレット\s*(\d+)\s*種")

def parse(h):
    rel = txt(RELEASE.search(h).group(1)) if RELEASE.search(h) else ""
    notes = txt(NOTES.search(h).group(1)) if NOTES.search(h) else ""
    mm, mp, mt = MONTH.search(rel), PRICE.search(notes), TOTAL.search(notes)
    mperiod, msecret = PERIOD.search(rel), SECRET.search(notes)
    return dict(
        name=txt(TITLE.search(h).group(1)) if TITLE.search(h) else None,
        ym=f"{mm.group(1)}-{int(mm.group(2)):02d}" if mm else None,
        period=mperiod.group(1) if mperiod else None,
        price=int(mp.group(1).replace(",", "")) if mp else None,
        total=int(mt.group(1)) if mt else None,
        secret=int(msecret.group(1)) if msecret else 0,
        raw=rel,
    )

if __name__ == "__main__":
    slugs, page = [], 1
    while True:
        u = CATEGORY if page == 1 else f"{CATEGORY}/page/{page}"
        try:
            h = get(u)
        except Exception:
            break
        found = ITEM.findall(h)
        if not found: break
        slugs += found
        page += 1
        time.sleep(1)
    print(f"一覧の掲載数: {len(slugs)}  ページ数: {page - 1}\n")

    rows, miss = [], collections.Counter()
    for s in slugs[:12]:
        time.sleep(1)
        try:
            p = parse(get(f"{BASE}/products/{s}"))
        except Exception as e:
            print(f"  ERROR {s}: {e}"); continue
        rows.append(p)
        for k in ("name", "ym", "price", "total"):
            if p.get(k) in (None, ""): miss[k] += 1
        print(f"  {p['ym']} {p['period'] or '　　'}  {str(p['price'])+'円':>6}  全{p['total']}種"
              f"{'(内S'+str(p['secret'])+')' if p['secret'] else '      '}  {(p['name'] or '')[:30]}")
    print("\n欠損:", dict(miss) or "なし")
    print("価格:", dict(collections.Counter(r["price"] for r in rows)))
    print("発売表記:", dict(collections.Counter(re.sub(r"\d+", "N", r["raw"]) for r in rows)))
