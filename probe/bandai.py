import re, html, time, urllib.request, collections
UA = "gacha-app-research/0.1 (contact: ouchi@fintechsys.co.jp)"
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=40) as f:
        return f.read().decode("utf-8", "replace")
def txt(x): return " ".join(html.unescape(re.sub(r"(?is)<[^>]+>", "", x)).split())

LIST = "https://gashapon.jp/products/"
CARD = re.compile(r'(?is)<a href="detail\.php\?jan_code=(\d+)"[^>]*class="c-card__link">.*?'
                  r'<p class="c-card__name">(.*?)</p>.*?'
                  r'<span class="c-card__price--main">([\d,]+)</span>')
MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(未定)?")
TOTAL = re.compile(r"全\s*(\d+)\s*種")

def parse_detail(h):
    d = {}
    for m in re.finditer(r'(?is)<dl class="pg-detailDefinition">(.*?)</dl>', h):
        dt = re.search(r'(?is)<dt[^>]*>(.*?)</dt>', m.group(1))
        dd = re.search(r'(?is)<dd[^>]*>(.*?)</dd>', m.group(1))
        if dt and dd: d[txt(dt.group(1))] = txt(dd.group(1))
    rel = d.get("発売時期", "")
    m = MONTH.search(rel)
    t = TOTAL.search(d.get("種類数", "") or "")
    p = re.search(r"([\d,]+)\s*円", d.get("価格(税込)", "") or "")
    return dict(ym=f"{m.group(1)}-{int(m.group(2)):02d}" if m else None,
                tbd=bool(m and m.group(3)), rel_raw=rel,
                total=int(t.group(1)) if t else None,
                price=int(p.group(1).replace(",", "")) if p else None,
                age=d.get("対象年齢"))

if __name__ == "__main__":
    listing = get(LIST)
    cards = CARD.findall(listing)
    print(f"一覧件数: {len(cards)}  (ページ {len(listing)}バイト)\n")
    rows, miss = [], collections.Counter()
    for jan, name, price in cards[:20]:
        time.sleep(1)
        p = parse_detail(get(f"https://gashapon.jp/products/detail.php?jan_code={jan}"))
        p["name"], p["jan"], p["list_price"] = txt(name), jan, int(price.replace(",", ""))
        rows.append(p)
        for k in ("ym", "total", "price"):
            if p[k] is None: miss[k] += 1
        flag = " TBD" if p["tbd"] else ""
        print(f"  {p['ym']}{flag:4}  {str(p['price'])+'円':>6}  全{p['total']}種   {p['name'][:32]}")
    print("\n欠損:", dict(miss) or "なし")
    print("未定フラグ:", sum(r["tbd"] for r in rows), "/", len(rows))
    print("一覧価格と詳細価格の不一致:", sum(1 for r in rows if r["price"] != r["list_price"]))
    print("発売月:", dict(sorted(collections.Counter(r["ym"] for r in rows).items(), key=lambda x:(x[0] is None,x[0]))))
