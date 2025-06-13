CREATE TABLE IF NOT EXISTS pending_registrations (id SERIAL PRIMARY KEY,
                                                            phone_number VARCHAR(15) NOT NULL UNIQUE,
                                                                                              password_hash VARCHAR(255) NOT NULL,
                                                                                                                         full_name VARCHAR(255) NOT NULL,
                                                                                                                                                email VARCHAR(255),
                                                                                                                                                      role VARCHAR(200) DEFAULT 'USER',
                                                                                                                                                                                phone_verification_otp VARCHAR(10) NOT NULL,
                                                                                                                                                                                                                   phone_verification_expiry TIMESTAMP NOT NULL,
                                                                                                                                                                                                                                                       created_at TIMESTAMPTZ DEFAULT NOW());