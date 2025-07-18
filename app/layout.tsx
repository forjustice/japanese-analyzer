import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ThemeProvider } from "./contexts/ThemeContext";

// 使用Inter字体
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

// 使用Noto Sans JP字体
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});

export const metadata: Metadata = {
  title: "日本語文章解析器 - AI驱动",
  description: "AI驱动・深入理解日语句法结构与词义",
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' }
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Japanese Analyzer" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* 主题初始化脚本 - 防止闪烁 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            function getThemePreference() {
              // 根据路径决定使用哪个主题键
              const isAdminPath = window.location.pathname.startsWith('/admin');
              const themeKey = isAdminPath ? 'theme' : 'userTheme';
              
              if (typeof localStorage !== 'undefined' && localStorage.getItem(themeKey)) {
                return localStorage.getItem(themeKey);
              }
              return 'system';
            }
            
            function getActualTheme(theme) {
              if (theme === 'system') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              }
              return theme;
            }
            
            const theme = getThemePreference();
            const actualTheme = getActualTheme(theme);
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(actualTheme);
            
            // 确保AuthModal能够正确获取主题状态
            window.__THEME_INITIALIZED__ = true;
          })();
        `}} />
        {/* Safari输入修复脚本 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            if (isSafari) {
              document.documentElement.classList.add('safari');
              // 修复Safari中的输入问题 - 不再使用硬编码颜色，让CSS处理
              document.addEventListener('DOMContentLoaded', function() {
                var inputs = document.querySelectorAll('input, textarea');
                inputs.forEach(function(input) {
                  // 移除硬编码颜色，让CSS变量处理主题
                  input.style.webkitTextFillColor = '';
                  input.style.opacity = '1';
                  input.style.webkitAppearance = 'none';
                  input.style.appearance = 'none';
                });
              });
            }
          })();
        `}} />
      </head>
      <body className={`${inter.className} ${notoSansJP.className} antialiased bg-background transition-colors duration-200`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/js/all.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}