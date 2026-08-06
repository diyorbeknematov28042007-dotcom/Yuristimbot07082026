-- Supabase SQL
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT,
    role TEXT DEFAULT 'user',
    bio TEXT,
    is_accepted_offer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    request_code TEXT UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(telegram_id),
    category TEXT,
    description TEXT,
    price_type TEXT,
    min_price NUMERIC,
    max_price NUMERIC,
    status TEXT DEFAULT 'active',
    accepted_lawyer_id BIGINT REFERENCES users(telegram_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dynamic_content (
    id SERIAL PRIMARY KEY,
    type TEXT,
    title TEXT,
    url_or_file_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
