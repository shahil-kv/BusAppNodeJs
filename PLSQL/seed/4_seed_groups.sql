DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM groups WHERE user_id = (SELECT id FROM users WHERE phone_number = '+1234567890') AND group_name = 'Family') THEN
        INSERT INTO groups (user_id, group_name, description, group_type)
        VALUES (
            (SELECT id FROM users WHERE phone_number = '+1234567890'),
            'Family',
            'Family contacts',
            'USER_DEFINED'
        );
    END IF;
END;
$$;