CREATE TABLE IF NOT EXISTS call_session (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    group_id INTEGER,
    contacts JSONB NOT NULL,
    current_index INTEGER DEFAULT 0,
    status VARCHAR(255) DEFAULT 'in_progress',
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_session_group_id ON call_session(group_id);
CREATE INDEX IF NOT EXISTS idx_call_session_user_id ON call_session(user_id);