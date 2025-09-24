-- Echo Mail - Row Level Security (RLS) Setup
-- Execute this in Supabase SQL Editor

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Drop existing policies if they exist (for re-running this script)
-- =============================================================================

DROP POLICY IF EXISTS "companies_select_policy" ON companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON companies;
DROP POLICY IF EXISTS "companies_update_policy" ON companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON companies;

DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;

DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_admin_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

DROP POLICY IF EXISTS "system_configs_select_policy" ON system_configs;
DROP POLICY IF EXISTS "system_configs_insert_policy" ON system_configs;
DROP POLICY IF EXISTS "system_configs_update_policy" ON system_configs;
DROP POLICY IF EXISTS "system_configs_delete_policy" ON system_configs;

-- =============================================================================
-- Companies Table Policies
-- =============================================================================

-- Allow authenticated users to view all companies
CREATE POLICY "companies_select_policy" ON companies
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert companies
CREATE POLICY "companies_insert_policy" ON companies
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update companies
CREATE POLICY "companies_update_policy" ON companies
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete companies
CREATE POLICY "companies_delete_policy" ON companies
    FOR DELETE
    TO authenticated
    USING (true);

-- =============================================================================
-- Contacts Table Policies
-- =============================================================================

-- Allow authenticated users to view all contacts
CREATE POLICY "contacts_select_policy" ON contacts
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert contacts
CREATE POLICY "contacts_insert_policy" ON contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update contacts
CREATE POLICY "contacts_update_policy" ON contacts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete contacts
CREATE POLICY "contacts_delete_policy" ON contacts
    FOR DELETE
    TO authenticated
    USING (true);

-- =============================================================================
-- Users Table Policies (More restrictive)
-- =============================================================================

-- Users can only view their own record
CREATE POLICY "users_select_policy" ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = id);

-- Only allow user creation through admin role or signup
CREATE POLICY "users_insert_policy" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow if user is admin
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
        -- Or if creating own account during signup
        OR auth.uid()::text = id
    );

-- Users can only update their own record
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = id)
    WITH CHECK (auth.uid()::text = id);

-- Admins can update any user's role
CREATE POLICY "users_admin_update_policy" ON users
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    );

-- Only admins can delete users
CREATE POLICY "users_delete_policy" ON users
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    );

-- =============================================================================
-- System Configs Table Policies
-- =============================================================================

-- All authenticated users can read system configs
CREATE POLICY "system_configs_select_policy" ON system_configs
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can modify system configs
CREATE POLICY "system_configs_insert_policy" ON system_configs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    );

CREATE POLICY "system_configs_update_policy" ON system_configs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    );

CREATE POLICY "system_configs_delete_policy" ON system_configs
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
            AND role = 'ADMIN'
        )
    );

-- =============================================================================
-- Grant access to service role (for backend operations)
-- =============================================================================

-- Allow service role to bypass RLS for backend operations
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE system_configs FORCE ROW LEVEL SECURITY;

-- Create service role policies (these run with elevated privileges)
CREATE POLICY "companies_service_policy" ON companies
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "contacts_service_policy" ON contacts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "users_service_policy" ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "system_configs_service_policy" ON system_configs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);