"""取り込み前の検証。通らなければそのメーカーを中止し、前回のデータを残す。

収集は静かに壊れる。エラーにならず、嘘のデータが DB に溜まるのが最悪の壊れ方。
書き込む前に値を疑うことでそれを防ぐ。
"""

import datetime

from makers import JST


def _month_range() -> tuple[str, str]:
    """発売月として妥当な範囲（過去30年〜未来2年）を 'YYYY-MM' で返す。

    見たいのは年の桁を誤認したような壊れ値で、実在の古い商品は正当。
    奇譚クラブは2010年からの全商品が取れる。
    """
    t = datetime.datetime.now(JST).date()
    return f"{t.year - 30}-{t.month:02d}", f"{t.year + 2}-{t.month:02d}"


def _out_of_range(p, lo: str, hi: str) -> bool:
    """値が妥当な範囲を外れているか。None は欠損であり、範囲外としては数えない。"""
    if not p["name"]:
        return True
    if p["price"] is not None and not 100 <= p["price"] <= 2000:
        return True
    if p["total"] is not None and not 1 <= p["total"] <= 30:
        return True
    return p["ym"] is not None and not lo <= p["ym"] <= hi


def check(items, listed_n, prev_count, prev_missing_rate, full, count_gate, log):
    """取り込んでよいか検証する。

    Args:
        items: 詳細まで取得した商品のリスト。
        listed_n: 一覧に載っていた件数。詳細の取得数とは別
        prev_count: DB に入っている前回の件数。
        prev_missing_rate: 前回の発売月の欠損率。データが無ければ None
        full: 全件モードか。欠損率の判定は全件を見ないと意味がないため
        count_gate: 件数の減少を見るか。全件が一覧に載らないメーカーでは無効にする

    Returns:
        中止すべきなら理由の文字列。問題なければ None
    """
    # ゲート1: 一覧の件数が前回の7割を切ったら、一覧の取得自体が壊れたとみなす。
    # 商品が実際に3割も消えることはない。prev_count = 0 は初回なので比較しない
    if count_gate and prev_count > 0 and listed_n < prev_count * 0.7:
        return f"reason=count_drop prev={prev_count} now={listed_n}"

    if not items:
        return None

    # ゲート2: 範囲外の値が1割を超えたら、パースがずれて別の項目を拾っている疑い。
    # 単発の外れ値はメーカー側の実データの揺れなので許容する
    lo, hi = _month_range()
    bad = sum(1 for p in items if _out_of_range(p, lo, hi))
    if bad / len(items) > 0.10:
        return f"reason=out_of_range bad={bad} total={len(items)}"

    # ゲート3: 発売月の欠損率が前回から20ポイント悪化したら、日付の取得が壊れた疑い。
    # ターリンは常時8%欠損するため、欠損そのものは異常ではない
    if full and prev_missing_rate is not None:
        rate = sum(1 for p in items if p["ym"] is None) / len(items)
        if rate > prev_missing_rate + 0.20:
            return f"reason=missing_ym_worse prev={prev_missing_rate:.0%} now={rate:.0%}"

    log.info(f"検証 ok out_of_range={bad}/{len(items)}")
    return None
