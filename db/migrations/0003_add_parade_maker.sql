-- Migration number: 0003 	 2026-09-02
-- パレードを収集対象に加える。カプセルトイのカテゴリだけを取る。
-- 利用規約が無く、robots.txt も商品ページを許可している

INSERT INTO makers (code, name, official_url, source_type) VALUES
  ('parade', 'パレード', 'https://www.parade-inc.net/', 'html');
