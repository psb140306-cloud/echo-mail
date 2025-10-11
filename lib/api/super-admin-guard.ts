import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * API route guard for super admin endpoints
 * Use this in API routes to ensure only super admins can access
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const guardResult = await superAdminGuard();
 *   if (guardResult.error) {
 *     return guardResult.error;
 *   }
 *
 *   // Your super admin logic here
 *   const { userId, profile } = guardResult;
 * }
 * ```
 */
export async function superAdminGuard() {
  try {
    const supabase = createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return {
        error: NextResponse.json(
          { error: 'Failed to fetch profile' },
          { status: 500 }
        ),
      };
    }

    if (!profile?.is_super_admin) {
      return {
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }

    return {
      userId: user.id,
      profile,
      supabase,
    };
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}
