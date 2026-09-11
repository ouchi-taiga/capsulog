"""期限が切れたセッションを消す。

Better Auth は期限切れの行を消さない。放っておくと溜まり続ける。
"""

NAME = "sessions"

WHERE = "FROM sessions WHERE expiresAt <= ?"


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。"""
    count = db.query(f"SELECT COUNT(*) AS n {WHERE}", [now])[0]["n"]
    if count and not dry_run:
        db.query(f"DELETE {WHERE}", [now])
    return count
