import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!config.app.accessPassword) {
      // If no password is set in .env, allow access by default
      return NextResponse.json({ success: true });
    }

    if (password === config.app.accessPassword) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Bad Request' }, { status: 400 });
  }
}
