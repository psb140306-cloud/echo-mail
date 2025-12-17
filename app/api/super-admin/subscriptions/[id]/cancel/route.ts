import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guardResult = await superAdminGuard();
    if (guardResult.error) {
      return guardResult.error;
    }

    const { supabase } = guardResult;

    // Cancel subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
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
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
