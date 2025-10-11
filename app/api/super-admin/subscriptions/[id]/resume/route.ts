import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';

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

    // Resume subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
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
    console.error('Error resuming subscription:', error);
    return NextResponse.json(
      { error: 'Failed to resume subscription' },
      { status: 500 }
    );
  }
}
