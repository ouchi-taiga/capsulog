"""確認されないまま期限が切れた仮登録を消す。"""

import datetime

NAME = "pending_users"

# 確認メールのトークンの寿命。これを過ぎたら、もう確認されない
VERIFY_HOURS = 24

# 仮登録は emailVerified が 0 の行。
# トークンの identifier はハッシュで入るため、メールアドレスでは突き合わせられない。
# 代わりに、登録からトークンの寿命を過ぎたかどうかで判定する
SELECT = """
    SELECT id FROM users
    WHERE emailVerified = 0 AND deletedAt IS NULL AND createdAt <= ?
"""


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。user_identities と sessions は CASCADE で消える。"""
    limit = datetime.datetime.fromisoformat(now) - datetime.timedelta(hours=VERIFY_HOURS)
    ids = [r["id"] for r in db.query(SELECT, [limit.isoformat(timespec="seconds")])]
    if ids and not dry_run:
        placeholders = ", ".join("?" for _ in ids)
        db.query(f"DELETE FROM users WHERE id IN ({placeholders})", ids)
    return len(ids)
