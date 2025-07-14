import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 输出当前的数据库配置信息（脱敏）
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      database: process.env.DB_NAME || 'japanese_analyzer',
      charset: 'utf8mb4',
      connectionLimit: process.env.VERCEL_ENV ? 5 : 10,
      hasSSL: process.env.DB_SSL === 'true',
      timezone: '+00:00',
      connectTimeout: process.env.VERCEL_ENV ? 30000 : 60000,
      // 环境信息
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION,
        TZ: process.env.TZ,
      }
    };

    console.log('🔍 [DatabaseConfig] 当前数据库配置:', dbConfig);

    return NextResponse.json({
      success: true,
      data: {
        config: dbConfig,
        warnings: [
          'MySQL2警告已修复，移除了无效的配置选项：',
          '- acquireTimeout (已移除)',
          '- timeout (已移除，使用connectTimeout)',
          '- reconnect (已移除)'
        ]
      }
    });

  } catch (error) {
    console.error('获取数据库配置时发生错误:', error);
    return NextResponse.json({
      success: false,
      message: '获取数据库配置失败',
      error: (error as Error).message
    }, { status: 500 });
  }
}