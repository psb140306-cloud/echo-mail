import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';

export const dynamic = 'force-dynamic'

const PLAN_PRICES: Record<string, number> = {
  starter: 29000,
  professional: 79000,
  enterprise: 199000,
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guardResult = await superAdminGuard();
    if (guardResult.error) {
      return guardResult.error;
    }

    const { supabase } = guardResult;

    const { plan_id } = await request.json();

    if (!PLAN_PRICES[plan_id]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Update subscription plan
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan_id,
        price_per_month: PLAN_PRICES[plan_id],
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription plan' },
      { status: 500 }
    );
  }
}
