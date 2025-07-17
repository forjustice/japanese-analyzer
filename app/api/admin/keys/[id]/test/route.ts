import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { error: '此功能已禁用，请直接修改.env文件' },
        { status: 403 }
      );
}
