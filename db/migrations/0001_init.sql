-- Migration number: 0001 	 2026-08-30
-- 商品マスタ。書き込むのは収集バッチと運営だけ

CREATE TABLE makers (
  id           INTEGER PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,   -- 'kitan' | 'tarlin' | 'takaratomy' | 'qualia' | 'bandai'
  name         TEXT NOT NULL,
  official_url TEXT NOT NULL,
  source_type  TEXT NOT NULL           -- 'wp_api' | 'json_api' | 'html' | 'manual'
);

CREATE TABLE products (
  id                 INTEGER PRIMARY KEY,
  maker_id           INTEGER NOT NULL REFERENCES makers(id),
  origin             TEXT    NOT NULL DEFAULT 'batch',  -- 'batch' | 'manual'
  source_id          TEXT    NOT NULL,   -- メーカー側の識別子
  name               TEXT    NOT NULL,
  price              INTEGER,            -- 円
  release_year_month TEXT,               -- 'YYYY-MM'
  release_precision  TEXT,               -- 'month' | 'period' | 'week'
  release_detail     TEXT,               -- 粒度に応じた値
  release_tbd        INTEGER NOT NULL DEFAULT 0,
  release_raw        TEXT,               -- 発売時期の生値
  total_variants     INTEGER,
  official_url       TEXT    NOT NULL,
  image_url          TEXT,               -- 保持のみ。配信しない
  content_hash       TEXT    NOT NULL,   -- 差分検知用
  fetched_at         TEXT    NOT NULL,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  UNIQUE (maker_id, source_id)
);

CREATE TABLE variants (
  id            INTEGER PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  display_order INTEGER NOT NULL,
  is_secret     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_release ON products(release_year_month, maker_id);
CREATE INDEX idx_products_maker   ON products(maker_id);
CREATE INDEX idx_variants_product ON variants(product_id);

INSERT INTO makers (code, name, official_url, source_type) VALUES
  ('kitan',      '奇譚クラブ',         'https://kitan.jp/',                     'wp_api'),
  ('tarlin',     'ターリン',           'https://tarlin-capsule.jp/',            'json_api'),
  ('takaratomy', 'タカラトミーアーツ', 'https://www.takaratomy-arts.co.jp/',    'html'),
  ('qualia',     'Qualia',             'https://www.qualia-45.jp/',             'html'),
  ('bandai',     'バンダイ',           'https://gashapon.jp/',                  'manual');
