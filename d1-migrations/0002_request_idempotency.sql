-- Apply once to existing D1 databases created with the initial schema.
-- Existing rows can remain NULL; every new request records its Telegram update ID.
ALTER TABLE requests ADD COLUMN source_update_id INTEGER;
CREATE UNIQUE INDEX requests_source_update_idx ON requests (source_update_id);
