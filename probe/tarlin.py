import re, html, json, ssl, time, urllib.request, collections, os
UA = "capsulog-probe/0.1 (contact: ouchi@fintechsys.co.jp)"
# ターリンのサーバは中間証明書を配信していないため、こちらで補う
CTX = ssl.create_default_context()
CTX.load_verify_locations(os.path.join(os.path.dirname(os.path.abspath(__file__)), "globalsign-intermediate.pem"))
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=30, context=CTX) as f:
        return f.read().decode("utf-8", "replace")

MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月")
def parse(d):
    desc = d.get("description") or ""
    m = MONTH.search(desc)
    return dict(
        id=d["id"], name=d.get("name"),
        ym=f"{m.group(1)}-{int(m.group(2)):02d}" if m else None,
        price=d.get("price"), total=d.get("kind"),
        first_line=desc.split("\n")[0][:40],
    )

if __name__ == "__main__":
    total = int(get("https://tarlin-capsule.jp/api/products/count"))
    ids = [x["id"] for x in json.loads(get("https://tarlin-capsule.jp/api/products?_limit=25&_sort=id:desc"))]
    print(f"count={total}  sample={len(ids)}\n")
    rows, miss = [], collections.Counter()
    for i in ids:
        time.sleep(1)
        p = parse(json.loads(get(f"https://tarlin-capsule.jp/api/products/{i}")))
        rows.append(p)
        for k in ("name", "ym", "price", "total"):
            if p[k] in (None, ""): miss[k] += 1
        print(f"  {p['ym']}  {str(p['price'])+'円':>6}  全{p['total']}種   {(p['name'] or '')[:34]}")
    print("\n欠損:", dict(miss) or "なし")
    print("価格:", dict(collections.Counter(r["price"] for r in rows)))
    print("種類:", dict(sorted(collections.Counter(r["total"] for r in rows).items(), key=lambda x:(x[0] is None,x[0]))))
