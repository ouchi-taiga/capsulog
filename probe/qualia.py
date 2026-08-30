import re, html, time, urllib.request, collections

UA = "capsulog-probe/0.1 (contact: ouchi@fintechsys.co.jp)"
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=25) as f:
        return f.read().decode("utf-8", "replace")
def txt(x): return " ".join(html.unescape(re.sub(r"(?is)<[^>]+>", "", x)).split())

BASE = "https://www.qualia-45.jp"
MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月")
PRICE = re.compile(r"([\d,]+)\s*円")
TOTAL = re.compile(r"全\s*(\d+)\s*種")

def parse(h):
    d = {}
    for m in re.finditer(r"(?is)<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", h):
        d[txt(m.group(1))] = txt(m.group(2))
    rel, pr = d.get("発売日", ""), d.get("価格", "")
    mm, mp, mt = MONTH.search(rel), PRICE.search(pr), TOTAL.search(pr)
    return dict(
        name=d.get("商品名"),
        ym=f"{mm.group(1)}-{int(mm.group(2)):02d}" if mm else None,
        price=int(mp.group(1).replace(",", "")) if mp else None,
        total=int(mt.group(1)) if mt else None,
    )

if __name__ == "__main__":
    listing = get(f"{BASE}/product.html")
    ids = sorted({int(m.group(1)) for m in re.finditer(r"/product/view/(\d+)", listing)}, reverse=True)
    print(f"一覧の掲載数: {len(ids)}  最大ID: {ids[0] if ids else None}\n")

    rows, miss = [], collections.Counter()
    for i in ids[:12]:
        time.sleep(1)
        try:
            p = parse(get(f"{BASE}/product/view/{i}"))
        except Exception as e:
            print(f"  ERROR {i}: {e}"); continue
        p["id"] = i
        rows.append(p)
        for k in ("name", "ym", "price", "total"):
            if p.get(k) in (None, ""): miss[k] += 1
        print(f"  {p['ym']}  {str(p['price'])+'円':>6}  全{p['total']}種   {(p['name'] or '')[:34]}")
    print("\n欠損:", dict(miss) or "なし")
    print("価格:", dict(collections.Counter(r["price"] for r in rows)))
