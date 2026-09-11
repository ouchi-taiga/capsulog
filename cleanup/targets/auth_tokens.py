"""期限が切れたトークンと、使い終わったトークンを消す。"""

NAME = "auth_tokens"

WHERE = "FROM auth_tokens WHERE expires_at <= ? OR used_at IS NOT NULL"


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。"""
    count = db.query(f"SELECT COUNT(*) AS n {WHERE}", [now])[0]["n"]
    if count and not dry_run:
        db.query(f"DELETE {WHERE}", [now])
    return count
