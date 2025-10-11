import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';

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

    const { status } = await request.json();

    if (!['active', 'suspended'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating tenant status:', error);
    return NextResponse.json(
      { error: 'Failed to update tenant status' },
      { status: 500 }
    );
  }
}
