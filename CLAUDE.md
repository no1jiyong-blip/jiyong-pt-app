# PT Coach Pro

신지용 트레이너 전용 PT 회원 관리 앱. Claude Code는 이 파일을 세션 시작 시
자동으로 읽습니다 — 매번 프로젝트 설명을 다시 할 필요 없습니다.

## 스택

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Supabase + Recharts.
패키지 매니저는 **npm**입니다 (`package-lock.json` 기준).
`.claude/settings.json`에 SessionStart 훅이 등록되어 있어 새 세션이 시작될 때
`npm install`이 자동으로 실행됩니다 — 수동으로 안 돌려도 됩니다.

## 디렉토리 구조

```
app/
├── layout.tsx               # 전체 레이아웃
├── page.tsx                 # 루트 → /login 리다이렉트
├── login/page.tsx           # 로그인 페이지
├── member/page.tsx          # 회원 메인 (4탭: HOME/WORKOUT/GROWTH/MISSION)
└── trainer/
    ├── page.tsx             # 트레이너 메인 (회원 목록 + 캘린더)
    └── member/[id]/page.tsx # 트레이너 회원 관리 상세 (단일 스크롤)

components/
├── member/                  # 회원 앱 4탭 + BottomNav, SmartCalendar 등
├── shared/                  # 차트/카드 등 회원·트레이너 공용 컴포넌트
├── trainer/                 # LiveRecordModal, RosterCard, Calendar
└── ui/                      # shadcn 스타일 기본 UI 프리미티브

lib/
├── supabase.ts               # Supabase 클라이언트 (anon key)
├── auth.ts                   # 로그인/세션 관리 (localStorage)
├── types.ts                  # 모든 TypeScript 인터페이스 + 비즈니스 로직
└── utils.ts

supabase/
├── schema.sql                # ⭐ 최종 통합 스키마 — 이 파일만 실행하면 됨
├── README.md                 # 실행 방법
└── legacy/                   # 예전 SUPABASE_FINAL/V2~V5/DUMMY SQL (기록용, 실행 X)
```

## 환경변수 (`.env.local`, git에는 안 올라감)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Vercel에 배포할 때도 동일한 값을 Environment Variables에 등록해야 합니다.

## 데이터베이스

9개 테이블: `users`, `members`, `sessions`, `exercise_records`, `homework`,
`personal_logs`, `benchmark_data`, `session_quality`, `body_measurements`.
스키마 변경이 필요하면 `supabase/schema.sql`을 직접 수정하고, 실행 방법은
`supabase/README.md` 참고. 모든 테이블 RLS는 비활성화되어 있고 클라이언트는
anon key로 직접 접근합니다 (트레이너/회원 인증은 `users` 테이블 대조 방식이며
비밀번호가 평문 저장됩니다 — 실제 서비스로 키우려면 Supabase Auth로 전환하는
게 우선순위 높은 개선 과제입니다).

## 테스트 계정

| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| 트레이너 | `admin` | `admin` (최초 로그인 후 변경 권장) |

## 디자인 시스템

### 컬러 토큰
```css
--volt: #D3FF52          /* 핵심 액센트 (형광 연두) */
--pt-0 ~ --pt-7          /* 배경 깊이 (검정 → 짙은 회색) */
--ink-0 ~ --ink-4        /* 텍스트 (흰색 → 어두운 회색) */
--danger: #ff3b3b
--info: #4488ff
--warn: #ff8c00
```

### 폰트
- **Bebas Neue Italic** — 대형 타이틀 (`.font-italic-display`)
- **Barlow Condensed** — 레이블, 배지 (`.font-cond`)
- **JetBrains Mono** — 숫자, 코드 (인라인 style로 적용)

### 핵심 CSS 클래스
```css
.pt-card          /* 글래스모피즘 카드 */
.btn-volt         /* Volt Green 버튼 */
.btn-ghost        /* 테두리 버튼 */
.tap-haptic       /* 터치 피드백 */
.section-bar      /* Volt 세로 바 (섹션 헤더) */
.anim-tab-slide   /* 탭 전환 애니메이션 */
.progress-track   /* 진행률 바 트랙 */
.progress-fill    /* 진행률 바 채움 */
```

## 화면 구조

**회원 앱 (4탭)**: HOME(세션 현황/캘린더/다음 수업) · WORKOUT(NEXT WORKOUT +
개인 운동 기록 + 히스토리) · GROWTH(STRENGTH/BODY/ANALYSIS 서브탭) ·
MISSION(트레이너 소견 + 숙제).

**트레이너 페이지**: 탭 없이 단일 스크롤. 회원 정보 → 세션 차감/수정 → PT
수업 추가/출석 처리 → 숙제 관리 → 운동 기록 피드 → STRENGTH DASHBOARD →
트레이너 소견/미션 입력 → 인바디 입력 → ACSM 목표 갭.

## 주요 비즈니스 로직

- **1RM 계산 (Brzycki 공식)**: `lib/types.ts`의 `calcOneRM(weight, reps)`
- **성별 SBD 분기**: 남성 = 스쿼트/데드리프트/벤치프레스, 여성 = 스쿼트/데드리프트/숄더프레스
- **풀업 역산**: 보조 무게가 낮을수록 강함 (`100 - minWeight`)
- **출석 완료 처리**: `sessions.status = "completed"` + `members.used_sessions + 1`을 함께 처리
- **ACSM 체지방률 등급**: 성별·연령대별 Elite/Good/Fair/Poor 기준 (`components/shared/BodyMetrics.tsx`)

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

`npm run build`로 프로덕션 빌드 검증, `npm run lint`로 ESLint 검사 가능
(둘 다 이미 정상 동작 확인됨).

## 코드 규칙

1. CSS 변수(`--volt`, `--pt-*`, `--ink-*`) 유지 — 디자인 시스템 이탈 금지
2. Named export 사용 — `export function ComponentName()`
3. `.map()` 렌더링 시 `key` 필수
4. `any` 금지 — `lib/types.ts` 인터페이스 활용
5. 글래스모피즘 유지 — `backdropFilter: "blur(16px)"` + 반투명 배경

## Git 워크플로

작업 완료 후 자동으로 커밋 + push합니다. 커밋 메시지는 변경 내용을 한국어로
요약: `feat: ...` / `fix: ...` / `style: ...` / `refactor: ...` / `chore: ...`

## 자주 발생하는 이슈

| 증상 | 원인 | 해결 |
|------|------|------|
| "회원 정보를 불러올 수 없다" | Supabase 프로젝트 일시정지 or `.env.local` 누락 | 대시보드에서 Restore 클릭 또는 `.env.local` 재생성 |
| `Export X doesn't exist` | named export 누락 | `export function X()` 형태 확인 |
| NEXT WORKOUT 미표시 | 예정 세션이 과거 날짜 | `nextSession` nullable 처리 + 항상 렌더 |
