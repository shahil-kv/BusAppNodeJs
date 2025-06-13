-- sql/run_all.sql
-- Initializes the contact_app database schema
-- Run with: psql -U postgres -d contact_app -f sql/run_all.sql
\i sql/schema/1_create_users.sql
\i sql/schema/2_create_refresh_tokens.sql
\i sql/schema/3_create_pending_registrations.sql
\i sql/schema/4_create_groups.sql
\i sql/schema/5_create_contacts.sql
\i sql/schema/6_create_call_session.sql
\i sql/schema/7_create_call_history.sql