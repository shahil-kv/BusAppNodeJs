DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM call_history WHERE call_sid = 'call_001') THEN
        INSERT INTO call_history (session_id, user_id, contact_id, contact_phone, status, call_sid, attempt, called_at)
        VALUES (
            (SELECT id FROM call_session WHERE id = 1),
            (SELECT id FROM users WHERE phone_number = '+1234567890'),
            (SELECT id FROM contacts WHERE phone_number = '+5556667777'),
            '+5556667777',
            'completed',
            'call_001',
            1,
            NOW() - INTERVAL '1 hour'
        );
    END IF;
END;
$$;