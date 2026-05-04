import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* 다크모드 플래시 방지 — CSS 로드 전에 data-theme + 배경색 선적용 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('admin_theme');if(t){document.documentElement.setAttribute('data-theme',t);if(t==='dark'){document.documentElement.style.background='#1A1A2E';document.documentElement.style.colorScheme='dark';}}}catch(e){}})();` }} />
        <meta name="application-name" content="아이플래너" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="아이플래너" />
        <meta name="description" content="AI 보험 관리 자동화 플랫폼 — 아이플래너" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#5E6AD2" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        {/* 브라우저 탭 파비콘 */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        {/* iOS/PWA 설치 아이콘 */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
