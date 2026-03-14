import { NextRequest, NextResponse } from 'next/server';
import { getMission, deleteMission } from '@/lib/db/missionStore';

export async function GET(
  _req: NextRequest,
  { params }: { params: { missionId: string } }
) {
  try {
    const mission = await getMission(params.missionId);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    return NextResponse.json({ mission });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch mission';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { missionId: string } }
) {
  try {
    await deleteMission(params.missionId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete mission';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
