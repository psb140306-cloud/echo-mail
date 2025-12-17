import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guardResult = await superAdminGuard();
    if (guardResult.error) {
      return guardResult.error;
    }

    const { supabase } = guardResult;

    // Delete tenant (cascade will handle related records)
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { error: 'Failed to delete tenant' },
      { status: 500 }
    );
  }
}
