import { NextResponse } from 'next/server';

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'aids2027';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || password !== ADMIN_PASSCODE) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin passcode' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'admin_session',
      value: 'true',
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
