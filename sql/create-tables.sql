-- Echo Mail Database Tables
-- Supabase SQL Editor에서 실행하세요

-- 1. Companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    region TEXT NOT NULL,
    "isActive" BOOLEAN DEFAULT true NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    position TEXT,
    "isActive" BOOLEAN DEFAULT true NOT NULL,
    "smsEnabled" BOOLEAN DEFAULT true NOT NULL,
    "kakaoEnabled" BOOLEAN DEFAULT false NOT NULL,
    "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'ADMIN' NOT NULL,
    "isActive" BOOLEAN DEFAULT true NOT NULL,
    "lastLoginAt" TIMESTAMPTZ,
    "emailVerified" TIMESTAMPTZ,
    image TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. System configs table
CREATE TABLE IF NOT EXISTS system_configs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general' NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert basic system config
INSERT INTO system_configs (key, value, description, category)
VALUES
    ('mail.check.interval', '30000', '메일 체크 간격 (밀리초)', 'mail'),
    ('sms.rate.limit', '100', 'SMS 발송 제한 (분당)', 'notification')
ON CONFLICT (key) DO NOTHING;

-- Insert admin user
INSERT INTO users (email, name, password, role)
VALUES ('admin@echomail.com', 'Admin', '$2b$12$dummy.hash.here', 'ADMIN')
ON CONFLICT (email) DO NOTHING;