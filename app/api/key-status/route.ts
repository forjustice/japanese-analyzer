import { NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';

const apiClient = new ApiClient();

export async function GET() {
  try {
    // 获取API KEY状态
    const keyStatus = await apiClient.getKeyStatus();
    const workingKeysCount = await apiClient.getWorkingKeysCount();
    
    return NextResponse.json({
      success: true,
      data: {
        totalKeys: keyStatus.length,
        workingKeys: workingKeysCount,
        keys: keyStatus,
        hasServerKeys: keyStatus.length > 0
      }
    });
  } catch (error) {
    console.error('Error getting key status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取密钥状态失败' 
      },
      { status: 500 }
    );
  }
}