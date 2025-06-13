DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM refresh_tokens WHERE token = 'token_12345') THEN
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES (
            (SELECT id FROM users WHERE phone_number = '+1234567890'),
            'token_12345',
            NOW() + INTERVAL '7 days'
        );
    END IF;
END;
$$;