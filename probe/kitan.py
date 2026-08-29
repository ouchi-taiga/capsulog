import re, html, json, time, urllib.request, collections

UA = "capsulog-probe/0.1 (contact: ouchi@fintechsys.co.jp)"
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=25) as f:
        return f.read().decode("utf-8", "replace"), dict(f.headers)
def txt(x): return " ".join(html.unescape(re.sub(r"(?is)<[^>]+>", "", x)).split())

MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(上旬|中旬|下旬)?")
PRICE = re.compile(r"([\d,]+)\s*円")
TOTAL = re.compile(r"全\s*(\d+)\s*種")

def parse(h):
    d = {}
    for m in re.finditer(r"(?is)<dl class=\"c-productDetail__detail-item\">(.*?)</dl>", h):
        dt = re.search(r"(?is)<dt>(.*?)</dt>", m.group(1))
        dd = re.search(r"(?is)<dd>(.*?)</dd>", m.group(1))
        if dt and dd: d[txt(dt.group(1))] = txt(dd.group(1))
    rel, pr = d.get("発売日", ""), d.get("価格", "")
    mm, mp, mt = MONTH.search(rel), PRICE.search(pr), TOTAL.search(pr)
    vs = [txt(m.group(1)) for m in re.finditer(r'(?is)<p class="c-productDetail__pickup-text">(.*?)</p>', h)]
    return dict(
        name=d.get("商品名"),
        ym=f"{mm.group(1)}-{int(mm.group(2)):02d}" if mm else None,
        period={"上旬":"early","中旬":"mid","下旬":"late"}.get(mm.group(3)) if mm else None,
        price=int(mp.group(1).replace(",","")) if mp else None,
        total=int(mt.group(1)) if mt else None,
        nvar=len(vs), rel_raw=rel, price_raw=pr,
    )

N = 40
body, hdr = get(f"https://kitan.jp/wp-json/wp/v2/products?per_page={N}&_fields=id,link")
items = json.loads(body)
print(f"X-WP-Total={hdr.get('X-WP-Total')}  sample={len(items)}\n")

rows, miss = [], collections.Counter()
for it in items:
    time.sleep(1)
    try:
        p = parse(get(it["link"])[0])
    except Exception as e:
        miss["fetch_error"] += 1; continue
    rows.append(p)
    for k in ("name","ym","price","total"):
        if p[k] is None: miss[k] += 1

print(f"取得 {len(rows)}件")
print("欠損:", dict(miss) or "なし")
print()
print("--- 発売月の分布 ---")
for k,v in sorted(collections.Counter(r["ym"] for r in rows).items()): print(f"  {k}  {v}")
print("--- 旬 ---")
for k,v in collections.Counter(r["period"] for r in rows).most_common(): print(f"  {k}  {v}")
print("--- 価格 ---")
for k,v in sorted(collections.Counter(r["price"] for r in rows).items(), key=lambda x:(x[0] is None,x[0])): print(f"  {k}  {v}")
print("--- 全何種 vs ラインナップ件数 ---")
diff=[r for r in rows if r["total"] is not None and r["nvar"]!=r["total"]]
print(f"  一致 {len(rows)-len(diff)} / {len(rows)}  不一致 {len(diff)}")
for r in diff[:12]:
    print(f"    全{r['total']}種 vs {r['nvar']}件  {r['name'][:38]}")
odd=[r for r in rows if r["price"] and r["price"] not in (100,200,300,400,500,600,700,800,1000)]
if odd:
    print("--- 特殊価格 ---")
    for r in odd: print(f"    {r['price']}円  {r['price_raw'][:40]}  {r['name'][:30]}")
