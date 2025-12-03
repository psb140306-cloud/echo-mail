import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { checkSuperAdminStatus, isSuperAdminEmail } from '@/lib/auth/super-admin';

export interface SuperAdminCheckResult {
  isSuperAdmin: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

/**
 * Check if the current user is a super admin
 *
 * 슈퍼어드민 확인 우선순위:
 * 1. user_metadata.role이 'super_admin'인 경우
 * 2. 환경변수 SUPER_ADMIN_EMAILS에 포함된 경우
 * 3. DB profiles.is_super_admin이 true인 경우 (레거시 지원)
 *
 * @returns SuperAdminCheckResult
 */
export async function checkSuperAdmin(): Promise<SuperAdminCheckResult> {
  try {
    const supabase = createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        isSuperAdmin: false,
        error: 'Not authenticated',
      };
    }

    const userRole = user.user_metadata?.role;
    const userEmail = user.email;

    // 1. 환경변수 또는 user_metadata.role 기반 확인 (우선)
    if (checkSuperAdminStatus(userEmail, userRole)) {
      return {
        isSuperAdmin: true,
        userId: user.id,
        email: userEmail,
      };
    }

    // 2. DB profiles.is_super_admin 확인 (레거시 지원)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profileError && profile?.is_super_admin === true) {
      return {
        isSuperAdmin: true,
        userId: user.id,
        email: userEmail,
      };
    }

    return {
      isSuperAdmin: false,
      userId: user.id,
      email: userEmail,
      error: 'Not a super admin',
    };
  } catch (error) {
    return {
      isSuperAdmin: false,
      error: 'Super admin check failed',
    };
  }
}

/**
 * Require super admin access, redirect if not authorized
 * Use this in Server Components
 */
export async function requireSuperAdmin(): Promise<void> {
  const result = await checkSuperAdmin();

  if (!result.isSuperAdmin) {
    if (!result.userId) {
      // Not logged in
      redirect('/auth/login');
    } else {
      // Logged in but not super admin
      redirect('/dashboard');
    }
  }
}

/**
 * Get super admin user or redirect
 * Use this when you need the user object
 *
 * 환경변수 SUPER_ADMIN_EMAILS 또는 user_metadata.role 기반으로 확인
 */
export async function getSuperAdminUser() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const userRole = user.user_metadata?.role;
  const userEmail = user.email;

  // 환경변수 또는 user_metadata.role 기반 확인
  const isSuperAdmin = checkSuperAdminStatus(userEmail, userRole);

  // 레거시 지원: DB profiles.is_super_admin 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!isSuperAdmin && !profile?.is_super_admin) {
    redirect('/dashboard');
  }

  return { user, profile, isSuperAdmin: isSuperAdmin || profile?.is_super_admin };
}
