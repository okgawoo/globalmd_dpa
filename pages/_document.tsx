import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
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
        {/* 브라우저 탭 파비콘 (웹 인디고 우선) */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* iOS/PWA 설치 아이콘은 기존 그대로 (모바일은 추후 별도 리뉴얼 예정) */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('admin_theme');if(t){document.documentElement.setAttribute('data-theme',t);if(t==='dark'){document.documentElement.style.background='#1A1A2E';document.documentElement.style.colorScheme='dark';}}}catch(e){}})();` }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
