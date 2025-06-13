CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(255) NOT NULL,
    description TEXT,
    group_type VARCHAR(20) DEFAULT 'USER_DEFINED',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_group_name_per_user UNIQUE (user_id, group_name)
);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);