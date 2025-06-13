DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM contacts WHERE phone_number = '+5556667777') THEN
        INSERT INTO contacts (group_id, contact_id, name, first_name, last_name, phone_number, country_code, raw_contact, is_contact_from_device)
        VALUES (
            (SELECT id FROM groups WHERE group_name = 'Family'),
            'contact_001',
            'Bob Wilson',
            'Bob',
            'Wilson',
            '+5556667777',
            '+1',
            '{"email": "bob.wilson@example.com"}'::JSONB,
            TRUE
        );
    END IF;
END;
$$;