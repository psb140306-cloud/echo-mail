import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface SuperAdminCheckResult {
  isSuperAdmin: boolean;
  userId?: string;
  error?: string;
}

/**
 * Check if the current user is a super admin
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return {
        isSuperAdmin: false,
        userId: user.id,
        error: 'Failed to fetch profile',
      };
    }

    return {
      isSuperAdmin: profile?.is_super_admin === true,
      userId: user.id,
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
 */
export async function getSuperAdminUser() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin) {
    redirect('/dashboard');
  }

  return { user, profile };
}
