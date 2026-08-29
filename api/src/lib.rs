//! カプセログの API。
//!
//! Cloudflare Workers 上で WASM として動く。
//! D1 に入っている商品データを返す。
//!
//! D1 には HTTP バインディング経由でのみ触れる。
//! 接続文字列が無いため、SQL は文字列で書く。
//!
//! # エンドポイント
//!
//! | メソッド | パス | 内容 |
//! |---|---|---|
//! | GET | `/health` | D1 まで届いているかの確認 |

use worker::*;

/// Workers のエントリポイント。
/// パスを見てハンドラに振り分ける。
///
/// # Errors
///
/// ハンドラが失敗したときにそのエラーを返す。
#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    match req.path().as_str() {
        "/health" => health(&env).await,
        _ => Response::error("Not Found", 404),
    }
}

/// D1 まで届いているかを確認する。
///
/// 疎通の確認だけを行う。
/// スキーマには触れない。
///
/// # Errors
///
/// `DB` のバインディングが無いとき、またはクエリが失敗したときに返す。
async fn health(env: &Env) -> Result<Response> {
    let db = env.d1("DB")?;
    let one: Option<i32> = db.prepare("SELECT 1").first(Some("1")).await?;

    match one {
        Some(1) => Response::ok("ok"),
        _ => Response::error("db unreachable", 500),
    }
}
