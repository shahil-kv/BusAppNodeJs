DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM call_session WHERE id = 1) THEN
        INSERT INTO call_session (user_id, group_id, contacts, status, total_calls)
        VALUES (
            (SELECT id FROM users WHERE phone_number = '+1234567890'),
            (SELECT id FROM groups WHERE group_name = 'Family'),
            '[{"phone_number": "+5556667777", "name": "Bob Wilson"}]'::JSONB,
            'in_progress',
            1
        );
    END IF;
END;
$$;