"""削除の対象。消すものが増えたらモジュールを足して ORDER に並べる。"""

from . import auth_tokens, pending_users, sessions

# 仮登録を先に消す。関連する行が CASCADE で一緒に消え、後続の対象が減る
ORDER = (pending_users, auth_tokens, sessions)
