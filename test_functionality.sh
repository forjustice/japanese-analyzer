#!/bin/bash

# 功能测试脚本
BASE_URL="http://localhost:3005"

echo "🧪 日语分析器功能测试"
echo "===================="

# 测试主页
echo "📄 测试主页访问..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ 主页正常访问 (HTTP $HTTP_STATUS)"
else
    echo "❌ 主页访问失败 (HTTP $HTTP_STATUS)"
fi

# 测试翻译API
echo "🔤 测试翻译功能..."
TRANSLATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/translate" \
    -H "Content-Type: application/json" \
    -d '{"text": "私は学生です。"}')
if echo "$TRANSLATE_RESPONSE" | grep -q "我是学生"; then
    echo "✅ 翻译功能正常工作"
    echo "   输入: 私は学生です。"
    echo "   输出: $(echo "$TRANSLATE_RESPONSE" | grep -o '"content":"[^"]*"' | sed 's/"content":"//g' | sed 's/"$//g')"
else
    echo "❌ 翻译功能失败"
    echo "   响应: $TRANSLATE_RESPONSE"
fi

# 测试分析API
echo "🔍 测试分析功能..."
ANALYZE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/analyze" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "你是专业的日语词法分析专家。请对以下日语文本进行逐字逐句的完整解析，输出JSON数组格式。\n\n输入文本：私は学生です。\n\n请开始解析："}')
if echo "$ANALYZE_RESPONSE" | grep -q "candidates"; then
    echo "✅ 分析功能正常工作"
    echo "   输入: 私は学生です。"
    echo "   响应: 流式数据正常返回"
else
    echo "❌ 分析功能失败"
    echo "   响应: $ANALYZE_RESPONSE"
fi

# 测试管理后台
echo "🛠️ 测试管理后台..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/login")
if [ "$ADMIN_STATUS" = "200" ]; then
    echo "✅ 管理后台正常访问 (HTTP $ADMIN_STATUS)"
else
    echo "❌ 管理后台访问失败 (HTTP $ADMIN_STATUS)"
fi

echo "===================="
echo "🎉 测试完成！"