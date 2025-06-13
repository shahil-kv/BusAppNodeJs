DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pending_registrations WHERE phone_number = '+1234567890') THEN
        INSERT INTO pending_registrations (phone_number, password_hash, full_name, email, role, phone_verification_otp, phone_verification_expiry)
        VALUES (
            '+1122334455',
            'hashed_password_3',
            'Alice Brown',
            'alice.brown@example.com',
            'USER',
            '123456',
            NOW() + INTERVAL '1 hour'
        );
    END IF;
END;
$$;