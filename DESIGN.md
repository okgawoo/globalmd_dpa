# DPA Design System

> `styles/admin.css` + 각 페이지 CSS Module 기준으로 추출한 디자인 토큰 레퍼런스

---

## Color System

모든 색상은 HSL 포맷으로 정의되며, 코드에서 `hsl(var(--token))` 형식으로 사용한다.

### Light Mode (기본)

#### Accent — 보라색 메인 컬러

| Token | HSL 값 | Hex (근사) | 용도 |
|---|---|---|---|
| `--accent` | `237 47% 59%` | `#656AC8` | 활성 탭, 버튼, 링크, 배지 텍스트 |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | accent 위의 텍스트 (흰색) |
| `--accent-bg` | `237 47% 95%` | `#ECEDF8` | 배지 배경, 연한 강조 영역 |
| `--icon-bg` | `= accent-bg` | — | 아이콘 배경 |
| `--icon-fg` | `= accent` | — | 아이콘 색상 |

#### Background — 레이어 구조

| Token | HSL 값 | Hex (근사) | 용도 |
|---|---|---|---|
| `--bg-app` | `240 5% 96%` | `#F3F4F6` | 앱 전체 배경 |
| `--bg-panel` | `0 0% 100%` | `#FFFFFF` | 카드, 팝업, 사이드바 |
| `--bg-elevated` | `240 5% 94%` | `#EFEFF1` | 인풋, 배지 배경, hover 영역 |
| `--bg-hover` | `240 5% 92%` | `#EBEBED` | hover 강조 배경 |

#### Text — 3단계 계층

| Token | HSL 값 | Hex (근사) | 용도 |
|---|---|---|---|
| `--text-primary` | `220 13% 10%` | `#161719` | 제목, 본문 주요 텍스트 |
| `--text-secondary` | `215 13% 45%` | `#636B78` | 부제목, 메타 정보 |
| `--text-tertiary` | `215 13% 60%` | `#8892A0` | 플레이스홀더, 비활성 탭 |

#### Border

| Token | HSL 값 | Hex (근사) | 용도 |
|---|---|---|---|
| `--border-default` | `214 20% 88%` | `#D5DAE2` | 기본 구분선, 카드 테두리 |
| `--border-hover` | `214 20% 80%` | `#C0C7D1` | hover 시 테두리 강조 |

#### Destructive

| Token | HSL 값 | 용도 |
|---|---|---|
| `--destructive` | `0 72% 51%` | 삭제 버튼, 에러 상태 |
| `--destructive-foreground` | `0 0% 98%` | 삭제 버튼 위 텍스트 |

### Dark Mode (`.admin-dark`)

#### Accent — 인디고 계열로 전환

| Token | HSL 값 | Hex | 용도 |
|---|---|---|---|
| `--accent` | `239 84% 67%` | `#6366F1` | 활성 상태 (인디고) |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | accent 위 텍스트 |
| `--accent-bg` | `239 45% 22%` | `#1E2052` | 배지/강조 배경 |

#### Background / Text / Border (dark)

| Token | HSL 값 | Hex |
|---|---|---|
| `--bg-app` | `0 0% 15%` | `#252525` |
| `--bg-panel` | `0 0% 15%` | `#262626` |
| `--bg-elevated` | `0 0% 20%` | `#333333` |
| `--bg-hover` | `0 0% 25%` | `#404040` |
| `--text-primary` | `0 0% 96%` | `#F5F5F5` |
| `--text-secondary` | `0 0% 62%` | `#9E9E9E` |
| `--text-tertiary` | `0 0% 45%` | `#737373` |
| `--border-default` | `0 0% 30%` | `#4D4D4D` |
| `--border-hover` | `0 0% 40%` | `#666666` |

### 컬러 사용 규칙

```css
color: hsl(var(--accent));
background: hsl(var(--bg-panel));
border: 1px solid hsl(var(--border-default));
background: hsl(var(--accent) / 0.1);  /* 투명도 */
```

- 임의 hex 하드코딩 금지 — 반드시 CSS 변수 사용
- 구버전 `globals.css`의 `--green: #1D9E75`는 admin 페이지에 사용하지 않음
- accent는 보라/인디고 단일 계열 유지 (라이트 237° / 다크 239°)

---

## Typography

### 폰트

- **한글**: Pretendard Variable
- **기본 폴백**: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
- **기본 사이즈**: 14px / line-height 1.5

### 텍스트 스케일

| 역할 | size | weight | 비고 |
|---|---|---|---|
| 페이지 제목 (H1) | `20px` | `700` | 모든 페이지 공통 기준 |
| 팝업/카드 제목 | `14–15px` | `600` | `.popupTitle`, `.cardTitle` |
| 섹션 레이블 | `11px` | `600` | uppercase + letter-spacing 0.6px |
| 본문 / 리스트 | `13–14px` | `400–500` | 주요 데이터 표시 |
| 메타 / 보조 | `11–12px` | `400` | 날짜, 부제목, 플레이스홀더 |
| 배지 | `10px` | `600` | pill 형태 상태 표시 |

### 헤더 영역 (AdminLayout 기준)

| 요소 | 색상 |
|---|---|
| 브랜드 텍스트 "insurance planner" | `--text-secondary` |
| 날짜 텍스트 | `--text-primary` |
| 아이콘 버튼 (다크모드·알림·설정) | `--text-primary` |
| 아바타 | accent 색상 유지 |

---

## Spacing

### 레이아웃

| 구분 | 값 |
|---|---|
| 페이지 패딩 (모바일) | `24px 20px` |
| 페이지 패딩 (데스크톱) | `24px 32px` |
| 최대 콘텐츠 너비 | `900px` (중앙 정렬) |
| 사이드바 너비 | `220px` (`--sidebar-width`) |
| 사이드바 축소 너비 | `60px` |
| 헤더 높이 | `52px` |

### 컴포넌트 간격

| 구분 | 값 |
|---|---|
| 카드 패딩 | `16–20px` |
| 카드 간 gap | `12–16px` |
| 섹션 간 margin | `16–20px` |
| 인라인 요소 gap | `6–10px` |
| 리스트 행 패딩 | `8–10px 0` |
| 네비게이션 항목 간 gap | `2px` |
| 네비게이션 항목 패딩 | `9px 12px` |

---

## Components

### Card

```css
background: hsl(var(--bg-panel));
border: 1px solid hsl(var(--border-default));
border-radius: 14px;
padding: 16px 20px;
```

### Badge / Pill

```css
font-size: 10px;
font-weight: 600;
padding: 2px 8px;
border-radius: 999px;
```

| 종류 | 배경 | 텍스트 |
|---|---|---|
| accent | `--accent-bg` | `--accent` |
| 경고 | amber-light | amber |
| 위험 | red-light | red |
| 성공 | green-light | green |

### Button

| 종류 | 스타일 |
|---|---|
| Primary | `bg: accent`, `color: white`, `border-radius: 8px`, `padding: 8–10px 16px` |
| Secondary | `bg: transparent`, `border: 1px solid border-default`, `color: text-secondary` |
| Destructive | `bg: destructive`, `color: white` |

### Tab Bar

```css
border-bottom: 2px solid hsl(var(--border-default));
/* 탭 버튼 */
padding: 10px 16px;
font-size: 13px;
border-bottom: 2px solid transparent;  /* 비활성 */
/* 활성 탭 */
color: hsl(var(--accent));
border-bottom-color: hsl(var(--accent));
font-weight: 600;
```

### Avatar

| 크기 | 값 |
|---|---|
| 기본 | `36px × 36px`, `border-radius: 50%`, `font-size: 12px` |
| 대형 | `46px × 46px`, `font-size: 15px` |

### Border Radius 기준

| 요소 | radius |
|---|---|
| 카드, 팝업 | `12–14px` |
| 버튼, 인풋 | `8px` |
| 소형 요소 (뱃지 버튼 등) | `6px` |
| Pill / 배지 | `999px` |

---

*Source: `styles/admin.css`, `Layout.module.css`, `Dashboard.module.css`, `Customers.module.css` / 마지막 업데이트: 2026-04-27*
