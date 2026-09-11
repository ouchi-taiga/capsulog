"""期限が切れたセッションを消す。

ログインのたびにそのユーザーの分は消しているが、
二度と来ないユーザーの行は残る。それをここで回収する。
"""

NAME = "sessions"

WHERE = "FROM sessions WHERE expires_at <= ?"


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。"""
    count = db.query(f"SELECT COUNT(*) AS n {WHERE}", [now])[0]["n"]
    if count and not dry_run:
        db.query(f"DELETE {WHERE}", [now])
    return count
