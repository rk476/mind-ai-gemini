import { NextRequest, NextResponse } from 'next/server';
import { createMission, listMissions } from '@/lib/db/missionStore';

export async function POST() {
  try {
    const mission = await createMission();
    return NextResponse.json({ missionId: mission._id, status: mission.status }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create mission';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const missions = await listMissions();
    return NextResponse.json({ missions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list missions';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
