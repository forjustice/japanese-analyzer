import { NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';

const API_KEY = process.env.API_KEY || '';
const apiClient = new ApiClient(API_KEY);

export async function GET() {
  try {
    // 获取API KEY状态
    const keyStatus = apiClient.getKeyStatus();
    const workingKeysCount = apiClient.getWorkingKeysCount();
    
    return NextResponse.json({
      success: true,
      data: {
        totalKeys: keyStatus.length,
        workingKeys: workingKeysCount,
        keys: keyStatus,
        hasServerKeys: API_KEY.length > 0
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