CREATE TABLE IF NOT EXISTS call_history (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES call_session(id),
    user_id INTEGER NOT NULL,
    group_id INTEGER,
    contact_id INTEGER REFERENCES contacts(id),
    contact_phone VARCHAR(50) NOT NULL,
    status VARCHAR(255) DEFAULT 'pending',
    call_sid VARCHAR(255),
    attempt INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 2,
    message_content TEXT,
    called_at TIMESTAMP,
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_history_call_sid ON call_history(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_history_contact_id ON call_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_history_session_id ON call_history(session_id);
CREATE INDEX IF NOT EXISTS idx_call_history_user_id ON call_history(user_id);