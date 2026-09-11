"""期限が切れた行を消す。日次で1回実行する。

収集とは別系統で動かす。消すものが増えたら targets に足す。
消す先は環境変数 D1_TARGET で選ぶ（既定はローカル）。
"""

import argparse
import datetime
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))

import d1
import logging_setup
from targets import ORDER

logger = logging.getLogger("cleanup")


def main():
    """対象を順に消す。1つ失敗しても残りは進める。"""
    ap = argparse.ArgumentParser(description="期限切れの行を消す")
    ap.add_argument("--dry-run", action="store_true", help="数えるだけで消さない")
    args = ap.parse_args()

    logging_setup.setup(Path(__file__).parent / "logs")
    now = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    db = d1.connect(str(Path(__file__).parent.parent))

    counts = {}
    ok = True
    for target in ORDER:
        try:
            counts[target.NAME] = target.run(db, now, args.dry_run)
        except Exception:  # 1つの失敗で全体を止めない。消せなかった分は翌日に持ち越す
            logger.exception(f"[{target.NAME}] 失敗")
            ok = False

    summary = " ".join(f"{k}={v}" for k, v in counts.items())
    logger.info(f"完了 {summary}" + (" dry_run=1" if args.dry_run else ""))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
