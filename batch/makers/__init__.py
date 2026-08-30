"""各メーカーの取得処理。

各モジュールは fetch(existing, full, limit, log) を持ち、
正規化した商品 dict のリストと、一覧に載っていた件数を返す。
"""

import datetime
import html
import re

# 発売月はメーカーの発表に合わせて日本時間で扱う
JST = datetime.timezone(datetime.timedelta(hours=9))

# 各社の表記に共通するパターン
MONTH = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月")
PRICE = re.compile(r"([\d,]+)\s*円")
TOTAL = re.compile(r"全\s*(\d+)\s*種")


def to_ym(m: re.Match | None) -> str | None:
    """MONTH のマッチを 'YYYY-MM' にする。マッチしていなければ None。"""
    return f"{m.group(1)}-{int(m.group(2)):02d}" if m else None


def txt(x: str) -> str:
    """HTML からタグを落とし、実体参照を戻し、空白を1つにまとめる。"""
    return " ".join(html.unescape(re.sub(r"(?is)<[^>]+>", "", x)).split())


def recent_threshold() -> str:
    """日次モードで詳細を取り直す境界の年月を 'YYYY-MM' で返す。

    発売が近い商品は時期や価格が動きうる。発売済みの商品は変わらない。
    境界は約2ヶ月前に置く。
    """
    d = datetime.datetime.now(JST).date() - datetime.timedelta(days=62)
    return f"{d.year}-{d.month:02d}"


def needs_detail(sid: str, existing: dict, full: bool) -> bool:
    """この商品の詳細ページを取りに行くべきか。

    全件モード・新規・発売月不明・発売が近い、のいずれかなら取る。
    """
    if full or sid not in existing:
        return True
    ym = existing[sid].get("release_year_month")
    return ym is None or ym >= recent_threshold()


def product(source_id, name, official_url, **kw):
    """商品 dict を正規化された形で組み立てる。

    メーカーごとに取れる項目が違うため、無いものは None のまま持つ。
    取れないものを埋めない。
    """
    return {
        "source_id": str(source_id),
        "name": name,
        "price": kw.get("price"),
        "ym": kw.get("ym"),
        "precision": kw.get("precision"),
        "detail": kw.get("detail"),
        "tbd": kw.get("tbd", 0),
        "raw": kw.get("raw"),
        "total": kw.get("total"),
        "official_url": official_url,
        "image_url": kw.get("image_url"),
        "variants": kw.get("variants", []),
    }
