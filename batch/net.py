"""HTTP 取得。全リクエストに UA を付け、1秒以上あける。"""

import ssl
import time
import urllib.request
from pathlib import Path

UA = "capsulog-batch/0.1 (contact: ouchi@fintechsys.co.jp)"
INTERVAL = 1.0

# ターリンのサーバは中間証明書を配信していないため、こちらで補う
_CTX = ssl.create_default_context()
_CTX.load_verify_locations(Path(__file__).parent / "globalsign-intermediate.pem")

_last = 0.0


def get(url: str, timeout: int = 30) -> bytes:
    """URL を取得してボディを返す。

    前回のリクエストから1秒たっていなければ、たつまで待つ。
    メーカーのサーバに負荷をかけないための待機で、外してはいけない。
    """
    global _last
    wait = _last + INTERVAL - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as f:
        body = f.read()
    _last = time.monotonic()
    return body


def get_text(url: str, timeout: int = 30) -> str:
    """URL を取得して UTF-8 文字列として返す。壊れたバイトは置換する。"""
    return get(url, timeout).decode("utf-8", "replace")
