import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export interface SuperAdminContext {
  userId: string;
  isSuperAdmin: true;
}

/**
 * API Route handler wrapper that requires super admin access
 * @param handler The actual route handler function
 * @returns Wrapped handler with super admin check
 */
export function withSuperAdmin<T = any>(
  handler: (request: NextRequest, context: SuperAdminContext, params?: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeParams?: { params: T }) => {
    try {
      const supabase = createServerClient();

      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 }
        );
      }

      // Check super admin status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to verify permissions' },
          { status: 500 }
        );
      }

      if (!profile?.is_super_admin) {
        return NextResponse.json(
          { error: 'Forbidden - Super admin access required' },
          { status: 403 }
        );
      }

      // Create context with verified user info
      const context: SuperAdminContext = {
        userId: user.id,
        isSuperAdmin: true,
      };

      // Call the actual handler
      return handler(request, context, routeParams?.params);
    } catch (error) {
      console.error('Super admin middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Check if current user is super admin without throwing
 * Returns the check result for conditional logic
 */
export async function checkSuperAdminAPI(): Promise<{
  isAuthorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const supabase = createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        isAuthorized: false,
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
        isAuthorized: false,
        userId: user.id,
        error: 'Failed to fetch profile',
      };
    }

    return {
      isAuthorized: profile?.is_super_admin === true,
      userId: user.id,
    };
  } catch (error) {
    return {
      isAuthorized: false,
      error: 'Super admin check failed',
    };
  }
}
