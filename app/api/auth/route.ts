import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 简单密码认证功能已移除，只支持用户认证模式
    return NextResponse.json({ 
      success: false, 
      message: '简单密码认证已停用，请使用用户注册/登录功能' 
    }, { status: 400 });
  } catch (error) {
    console.error('身份验证错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '验证过程中发生错误' 
    }, { status: 500 });
  }
}

// 获取是否需要密码验证的状态
export async function GET() {
  try {
    // 检查是否配置了数据库（只支持用户认证模式）
    const hasDatabase = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME);
    
    if (hasDatabase) {
      // 如果配置了数据库，返回特殊标识表示应该使用用户认证模式
      return NextResponse.json({ 
        useUserAuth: true,
        message: '使用用户认证模式'
      });
    }
    
    // 简单密码认证功能已移除，不再支持CODE环境变量
    return NextResponse.json({ 
      requiresAuth: false,
      message: '简单密码认证已停用，建议配置数据库使用用户认证模式'
    });
  } catch (error) {
    console.error('获取验证状态错误:', error);
    return NextResponse.json({ 
      requiresAuth: false 
    });
  }
} 