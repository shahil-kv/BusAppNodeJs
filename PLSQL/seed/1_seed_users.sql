DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE phone_number = '+1234567890') THEN
        INSERT INTO users (phone_number, password_hash, full_name, email, is_phone_verified, is_premium, role)
        VALUES ('+1234567890', 'hashed_password_1', 'John Doe', 'john.doe@example.com', TRUE, FALSE, 'USER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE phone_number = '+0987654321') THEN
        INSERT INTO users (phone_number, password_hash, full_name, email, is_phone_verified, is_premium, role)
        VALUES ('+0987654321', 'hashed_password_2', 'Jane Smith', 'jane.smith@example.com', FALSE, TRUE, 'ADMIN');
    END IF;
END;
$$;