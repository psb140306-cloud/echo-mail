-- WARNING: This script will delete ALL data in the public schema.
-- Use this only if you want to start with a fresh database.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
