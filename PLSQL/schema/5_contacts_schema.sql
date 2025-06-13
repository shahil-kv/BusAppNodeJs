CREATE TABLE IF NOT EXISTS contacts
    (id SERIAL PRIMARY KEY,
               group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                                                                         contact_id VARCHAR(255),
                                                                                    name VARCHAR(255) NOT NULL,
                                                                                                      first_name VARCHAR(255),
                                                                                                                 last_name VARCHAR(255),
                                                                                                                           phone_number VARCHAR(50) NOT NULL,
                                                                                                                                                    country_code VARCHAR(10),
                                                                                                                                                                 raw_contact JSONB,
                                                                                                                                                                             created_at TIMESTAMP DEFAULT NOW(),
                                                                                                                                                                                                          updated_at TIMESTAMP DEFAULT NOW(),
                                                                                                                                                                                                                                       is_contact_from_device BOOLEAN DEFAULT TRUE);


CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts(group_id);


CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);