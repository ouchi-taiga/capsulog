"""期限が切れた確認トークンを消す。

使い終わったトークンは Better Auth がその場で消す。ここで拾うのは期限切れだけ。
"""

NAME = "auth_tokens"

WHERE = "FROM auth_tokens WHERE expiresAt <= ?"


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。"""
    count = db.query(f"SELECT COUNT(*) AS n {WHERE}", [now])[0]["n"]
    if count and not dry_run:
        db.query(f"DELETE {WHERE}", [now])
    return count
