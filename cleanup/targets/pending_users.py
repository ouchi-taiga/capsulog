"""確認されないまま期限が切れた仮登録を消す。"""

NAME = "pending_users"

# 仮登録は users.email が NULL の行。確認が済むとメールが入る。
# 有効な確認トークンが残っているものは、まだ待っている途中なので消さない
SELECT = """
    SELECT u.id FROM users u
    WHERE u.email IS NULL AND u.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM auth_tokens t
        WHERE t.user_id = u.id AND t.purpose = 'email_verify'
          AND t.used_at IS NULL AND t.expires_at > ?
      )
"""


def run(db, now: str, dry_run: bool) -> int:
    """消した件数を返す。user_identities と auth_tokens は CASCADE で消える。"""
    ids = [r["id"] for r in db.query(SELECT, [now])]
    if ids and not dry_run:
        placeholders = ", ".join("?" for _ in ids)
        db.query(f"DELETE FROM users WHERE id IN ({placeholders})", ids)
    return len(ids)
