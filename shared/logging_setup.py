"""ログの設定。batch と cleanup で同じ形にする。"""

import datetime
import logging
import sys
from pathlib import Path

JST = datetime.timezone(datetime.timedelta(hours=9))


def setup(log_dir: Path):
    """stdout と log_dir の2箇所に流す。

    stdout は GitHub Actions のジョブログ用。ファイルは手元での実行を残す用で、
    info.log に全部、error.log に WARNING 以上だけを追記する。
    時刻は発売月の扱いと同じく日本時間で出す。
    """
    logging.Formatter.converter = lambda *_: datetime.datetime.now(JST).timetuple()
    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s %(filename)s:%(lineno)d %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log_dir.mkdir(exist_ok=True)

    handlers = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_dir / "info.log", encoding="utf-8"),
        logging.FileHandler(log_dir / "error.log", encoding="utf-8"),
    ]
    handlers[2].setLevel(logging.WARNING)
    for h in handlers:
        h.setFormatter(fmt)
    logging.basicConfig(level=logging.INFO, handlers=handlers)
