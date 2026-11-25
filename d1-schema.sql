-- Fresh Cloudflare D1 schema. No Supabase data is imported.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL UNIQUE,
  full_name TEXT,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'lawyer')),
  bio TEXT,
  is_accepted_offer INTEGER NOT NULL DEFAULT 0 CHECK (is_accepted_offer IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT NOT NULL UNIQUE,
  source_update_id INTEGER NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price_type TEXT NOT NULL CHECK (price_type IN ('agreed', 'free', 'exact')),
  min_price INTEGER,
  max_price INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted')),
  accepted_lawyer_id INTEGER REFERENCES users(telegram_id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS requests_user_created_idx ON requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_lawyer_created_idx ON requests (accepted_lawyer_id, created_at DESC);
CREATE TABLE IF NOT EXISTS dynamic_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  url_or_file_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS dynamic_content_type_idx ON dynamic_content (type);
