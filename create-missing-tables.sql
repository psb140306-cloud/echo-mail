-- 빠진 테이블 생성 SQL
-- Supabase SQL Editor에서 실행

-- 1. tenant_users (사용자-테넌트 관계) ⭐️ 필수!
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    accepted_at TIMESTAMP(3),
    invited_by TEXT REFERENCES public.users(id),
    invited_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_users_tenant_id_idx ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_users_user_id_idx ON public.tenant_users(user_id);

-- 2. tenant_invitations (팀원 초대)
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    invited_by TEXT NOT NULL REFERENCES public.users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP(3) NOT NULL,
    accepted_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS tenant_invitations_tenant_id_idx ON public.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_invitations_email_idx ON public.tenant_invitations(email);
CREATE INDEX IF NOT EXISTS tenant_invitations_token_idx ON public.tenant_invitations(token);

-- 3. invoices (결제 내역)
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES public.subscriptions(id),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KRW',
    status TEXT NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMP(3),
    invoice_url TEXT,
    stripe_invoice_id TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS invoices_subscription_id_idx ON public.invoices(subscription_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);

-- 4. email_accounts (이메일 계정 설정)
CREATE TABLE IF NOT EXISTS public.email_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_secure BOOLEAN NOT NULL DEFAULT true,
    imap_user TEXT NOT NULL,
    imap_password TEXT NOT NULL,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT true,
    smtp_user TEXT,
    smtp_password TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_check_at TIMESTAMP(3),
    last_error TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS email_accounts_tenant_id_idx ON public.email_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS email_accounts_is_active_idx ON public.email_accounts(is_active);

-- 5. accounts (NextAuth OAuth 계정) ⭐️ 필수!
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON public.accounts(user_id);

-- 6. sessions (NextAuth 세션) ⭐️ 필수!
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON public.sessions(session_token);

-- 7. verification_tokens (이메일 인증 토큰) ⭐️ 필수!
CREATE TABLE IF NOT EXISTS public.verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (identifier, token)
);

CREATE INDEX IF NOT EXISTS verification_tokens_token_idx ON public.verification_tokens(token);

-- 권한 설정
GRANT ALL ON public.tenant_users TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.tenant_invitations TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.invoices TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.email_accounts TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.accounts TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.sessions TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.verification_tokens TO postgres, anon, authenticated, service_role;

-- RLS (Row Level Security) 활성화
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 완료 메시지
SELECT 'Missing tables created successfully!' as message;

-- 생성된 테이블 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'tenant_users',
    'tenant_invitations',
    'invoices',
    'email_accounts',
    'accounts',
    'sessions',
    'verification_tokens'
  )
ORDER BY table_name;
