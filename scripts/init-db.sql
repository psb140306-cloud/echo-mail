-- Echo Mail Database Initialization Script
-- Run this script to create the database and user

-- Create database
CREATE DATABASE echomail;

-- Create user
CREATE USER echomail_user WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE echomail TO echomail_user;

-- Connect to the database
\c echomail;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO echomail_user;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For efficient indexing