-- Migration number: 0002 	 2026-09-01
-- 奇譚クラブの source_id を WP の post ID から URL スラッグへ移す。
-- REST API が海外 IP から遮断されており、一覧をサイトマップから取るため。
-- スラッグは official_url から導出でき、全行で一意なことを確認済み

UPDATE products
SET source_id = RTRIM(REPLACE(official_url, 'https://kitan.jp/products/', ''), '/')
WHERE maker_id = (SELECT id FROM makers WHERE code = 'kitan');
