#!/bin/bash

# =============================================
# Supabase Security Deployment Script
# =============================================
# This script deploys database triggers and RLS policies to Supabase
# Run this script to enable fundamental security for tenant isolation
# =============================================

set -e

echo "=========================================="
echo "Supabase Security Deployment"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
echo "Checking Supabase login status..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please login first:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Supabase CLI ready"
echo ""

# Get project reference
echo "Available Supabase projects:"
supabase projects list

echo ""
echo "Enter your Supabase project reference (e.g., abcdefghijklmnop):"
read PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference cannot be empty"
    exit 1
fi

echo ""
echo "=========================================="
echo "Deploying migrations to: $PROJECT_REF"
echo "=========================================="
echo ""

# Deploy trigger migration
echo "1. Deploying tenant auto-creation trigger..."
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres" \
  --include-all \
  --file "./migrations/01_create_tenant_trigger.sql"

if [ $? -eq 0 ]; then
    echo "✅ Tenant trigger deployed successfully"
else
    echo "❌ Failed to deploy tenant trigger"
    exit 1
fi

echo ""

# Deploy RLS policies
echo "2. Deploying RLS policies..."
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres" \
  --include-all \
  --file "./migrations/02_enable_rls_policies.sql"

if [ $? -eq 0 ]; then
    echo "✅ RLS policies deployed successfully"
else
    echo "❌ Failed to deploy RLS policies"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Security deployment completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test with a new user signup"
echo "2. Verify tenant is auto-created"
echo "3. Verify RLS policies are working"
echo "4. Remove application-level tenant creation code (optional)"
echo ""
