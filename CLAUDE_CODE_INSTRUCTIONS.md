# 🏋️ PT Coach Pro — Claude Code 작업지시서

> **신지용 트레이너 전용 PT 회원 관리 시스템**  
> 이 파일을 Claude Code에게 먼저 읽히고 작업을 시작하세요.

---

## 📋 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | PT Coach Pro |
| 개발자 | 신지용 트레이너 (재활 운동 전문가 9년 경력) |
| 스택 | Next.js 16 + TypeScript + Tailwind CSS v4 + Supabase + Recharts |
| 배포 | Vercel (GitHub 연동 자동 배포) |
| 패키지 매니저 | pnpm |

---

## 🗂 디렉토리 구조

```
pt-app/
├── app/
│   ├── layout.tsx               # 전체 레이아웃
│   ├── page.tsx                 # 루트 → /login 리다이렉트
│   ├── login/page.tsx           # 로그인 페이지
│   ├── member/page.tsx          # 회원 메인 (4탭: HOME/WORKOUT/GROWTH/MISSION)
│   └── trainer/
│       ├── page.tsx             # 트레이너 메인 (회원 목록 + 캘린더)
│       └── member/[id]/page.tsx # 트레이너 회원 관리 상세 (단일 스크롤)
│
├── components/
│   ├── member/
│   │   ├── BottomNav.tsx        # 회원 앱 하단 탭 바
│   │   ├── TabHeader.tsx        # 탭 상단 헤더 (Bebas Neue)
│   │   ├── SmartCalendar.tsx    # 수업 날 표시 캘린더
│   │   └── tabs/
│   │       ├── HomeTab.tsx      # HOME: 세션 현황, 다음 수업, 캘린더
│   │       ├── WorkoutTab.tsx   # WORKOUT: NEXT WORKOUT, 개인 운동 일지, 히스토리
│   │       ├── GrowthTab.tsx    # GROWTH: 근력 차트, 인바디, 분석
│   │       └── MissionTab.tsx   # MISSION: 주간 미션, 숙제 체크리스트
│   │
│   ├── shared/
│   │   ├── HeroSBDChart.tsx     # 3대 운동 Area 차트 (성별 분기)
│   │   ├── MuscleBalanceRadar.tsx # 6축 레이더 차트
│   │   ├── OneRMReportCard.tsx  # 1RM 리포트 카드
│   │   ├── SupportCarousel.tsx  # 보조 종목 캐러셀 (상체/하체)
│   │   ├── BodyMetrics.tsx      # ACSM 인바디 분석
│   │   ├── AnalysisInsights.tsx # 출석 분석 + 캐릭터 진단
│   │   ├── TrainerAssessmentCard.tsx # 트레이너 소견 말풍선
│   │   └── Confetti.tsx         # PB 달성 폭죽 이펙트
│   │
│   └── trainer/
│       └── LiveRecordModal.tsx  # PT 기록 입력 모달 (코어/밸런스 점수)
│
├── lib/
│   ├── supabase.ts              # Supabase 클라이언트
│   ├── auth.ts                  # 로그인/세션 관리 (localStorage)
│   ├── types.ts                 # 모든 TypeScript 인터페이스
│   └── utils.ts                 # 날짜 포맷, getTodayISO 등 유틸
│
├── public/
│   └── logo.png                 # Volt Green 러닝 로고
│
├── SUPABASE_FINAL.sql           # ⭐ 메인 더미 데이터 SQL (이것만 실행)
├── SUPABASE_V5_WORKOUT.sql      # condition_score, workout_memo 컬럼 추가
└── .env.local                   # 환경변수 (아래 참고)
```

---

## 🔑 환경변수 (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://yzyazinkoqagyjtinsip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_0NYYic-3L7aOg4VH650SNg_LKnLOR6E
```

> ⚠️ `.env.local` 파일이 없으면 앱이 실행되지 않습니다. 루트에 꼭 생성하세요.

---

## 🗄 데이터베이스 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 로그인 계정 (username, password, role) |
| `members` | 회원 정보 + trainer_assessment + weekly_mission |
| `sessions` | PT 수업 일정 및 기록 |
| `exercise_records` | 수업별 운동 기록 (종목/무게/횟수) |
| `personal_logs` | 회원 개인 운동 일지 + condition_score + workout_memo |
| `homework` | 이주의 숙제 |
| `body_measurements` | 인바디 측정 이력 |
| `session_quality` | 코어/밸런스 점수 (트레이너 입력) |
| `benchmark_data` | ACSM 성별/연령별 벤치마크 |

### SQL 실행 순서
```
Supabase SQL 편집기 → 새 쿼리 → 붙여넣기 → 실행

1. SUPABASE_FINAL.sql       (기본 데이터 + 더미 세션 20개씩)
2. SUPABASE_V5_WORKOUT.sql  (개인 운동 컬럼 추가)
```

---

## 🔐 테스트 계정

| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| 트레이너 | `admin` | `admin` |
| 회원 (남, 1995) | `minsu` | `1234` |
| 회원 (여, 1998) | `yeseo` | `1234` |

---

## 🎨 디자인 시스템

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

---

## 📱 회원 앱 구조 (4탭)

### HOME 탭
- 세션 현황 (총 등록 / 진행 / 잔여)
- 잔여 ≤5 Volt 글로우, ≤3 Danger 펄스
- SmartCalendar (수업날 형광 점)
- 다음 수업 카드 + 트레이너 메모

### WORKOUT 탭
- **NEXT WORKOUT** — 항상 표시 (세션 없어도)
  - 당일: `TODAY` 배지 + `오늘의 운동` Volt 타이틀
  - 미래: `D-N` 배지
  - 세션 없음: "예정된 수업이 없습니다"
- **개인 운동 기록 폼**
  - SET / WEIGHT(KG) / REPS — flex 레이아웃 (겹침 없음)
  - RPE 1~10 버튼 + 설명 박스
  - 컨디션 1~10 버튼 + 설명 박스
  - 대표 메모 입력 (카드 제목으로 노출)
  - PB 감지 → Confetti 폭죽
- **운동 히스토리** — PT/개인 통합 타임라인
  - 타입 필터: 전체보기 / PT 수업 / 개인 운동
  - 기간 필터: 전체 / 이번 주 / 이번 달
  - SET 배지: PT=Volt 테두리, 개인=다크 배지
  - 아코디언 확장 → 세부 기록 + 트레이너 피드백

### GROWTH 탭 (3 서브탭)
**STRENGTH**
- MUSCLE BALANCE 레이더 (6축: 상체/하체/등/어깨/코어/밸런스)
- 1RM 리포트 카드 (성별 분기: 남=벤치, 여=숄더프레스)
- Hero SBD 차트 (Area + PR 노드 + Ghost Runner + 예측 점선)
- Support Carousel (상체/하체 탭, 풀업 역산, 성장 폭 정렬)

**BODY**
- ACSM 등급 (Elite/Good/Fair/Poor) — 성별/연령별 자동 판정
- 6종 인바디 지표 카드 (클릭 시 히스토리 팝업)
- 체형 맵 (산점도)
- Gap Analysis (중첩 막대 + 목표 게이지)
- 예상 달성 기간 자동 산출

**ANALYSIS**
- 이번 달 출석 (수업/개인/총합)
- 저번 주/달 대비 비교 바
- 4주 성장 캐릭터 진단 (폭발적/꾸준한/재도약/감소/기초)
- ACSM 기반 인사이트 카드

### MISSION 탭
- 트레이너 소견 말풍선 (`trainer_assessment`)
- 이번 주 핵심 미션 (`weekly_mission`)
- 숙제 체크리스트

---

## 🖥 트레이너 관리자 페이지 (단일 스크롤)

> ⚠️ 탭 구조 없음. 세로 스크롤 하나로 모든 기능 접근

### 섹션 순서
1. **회원 정보** — 이름/성별/나이/목표/특이사항
2. **세션 차감** — "PT 수업 완료 (1회 차감)" 원터치 버튼
3. **세션 수 수정** — 총 등록 / 사용 숫자 직접 수정
4. **PT 수업 추가** — 날짜/시간/제목 → 수업 목록
5. **수업 목록** — 예정 세션: `출석 완료` 버튼 → 자동 차감
6. **이주의 숙제** — 추가/삭제
7. **운동 기록 통합 피드** — PT + 개인 운동 타임라인
8. **STRENGTH DASHBOARD** — 회원과 동일한 근력 차트 전체
   - MuscleBalanceRadar
   - 1RM 리포트 (성별 분기)
   - HeroSBDChart
   - SupportCarousel
9. **트레이너 소견 & 미션** — textarea 저장 → 회원 앱 즉시 반영
10. **인바디 입력** — 6종 수치 저장 → ACSM 자동 연산
11. **ACSM 목표 갭** — 체지방률/골격근량/WHR 게이지

---

## ⚡ 주요 비즈니스 로직

### 1RM 계산 (Brzycki 공식)
```typescript
export function calcOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
}
```

### 성별 SBD 분기
```typescript
// 남성: 스쿼트 / 데드리프트 / 벤치프레스
// 여성: 스쿼트 / 데드리프트 / 숄더프레스 (동기부여 고려)
```

### 풀업 역산 (보조 무게 낮을수록 강함)
```typescript
// 풀업머신 보조 무게 40kg → 점수 60
sessionVal = Math.max(0, 100 - minWeight);
```

### 출석 완료 + 세션 자동 차감
```typescript
// 1) sessions.status = "completed"
// 2) members.used_sessions + 1
// 두 작업을 동시에 처리
```

### ACSM 체지방률 등급 기준
```
남성 30대: Elite ≤12%, Good ≤22%, Fair ≤27%, Poor >27%
여성 20대: Elite ≤18%, Good ≤26%, Fair ≤32%, Poor >32%
```

---

## 🚀 로컬 실행 방법

```bash
# 1. 의존성 설치
cd pt-app
pnpm install

# 2. 환경변수 확인 (.env.local 있는지)
ls -la | grep env

# 3. 개발 서버 실행
pnpm dev

# 4. 브라우저에서 확인
# http://localhost:3000
```

---

## 📦 GitHub + Vercel 배포

```bash
# GitHub 원격 저장소 연결 (최초 1회)
git init
git remote add origin https://github.com/YOUR_USERNAME/pt-coach-pro.git
git add .
git commit -m "initial: PT Coach Pro"
git push -u origin main

# 이후 자동 배포
# main 브랜치 push → Vercel 자동 감지 → 빌드 → 배포
```

### Vercel 환경변수 설정
```
Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

NEXT_PUBLIC_SUPABASE_URL    = https://yzyazinkoqagyjtinsip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_0NYYic-3L7aOg4VH650SNg_LKnLOR6E
```

---

## 🤖 Claude Code 작업 규칙

### 파일 수정 시 반드시 지킬 것

1. **디자인 시스템 유지** — CSS 변수(`--volt`, `--pt-*`, `--ink-*`) 반드시 사용
2. **Named Export 사용** — `export function ComponentName()` 형태 유지
3. **React key 필수** — `.map()` 사용 시 `key={...}` 항상 추가
4. **타입 안전성** — `any` 사용 금지, `lib/types.ts` 인터페이스 활용
5. **글래스모피즘 유지** — `backdropFilter: "blur(16px)"` + 반투명 배경

### Git 커밋 규칙
```bash
# 수정 후 자동으로 커밋 + 푸시
git add .
git commit -m "fix: NEXT WORKOUT 항상 표시"
git push origin main
```

### 커밋 메시지 형식
```
feat: 새 기능 추가
fix: 버그 수정
style: 디자인/UI 수정
refactor: 코드 리팩토링
chore: 설정 변경
```

---

## ⚠️ 자주 발생하는 이슈

| 증상 | 원인 | 해결 |
|------|------|------|
| "회원 정보를 불러올 수 없다" | Supabase 일시정지 or .env.local 없음 | 대시보드에서 Restore 클릭 또는 .env.local 생성 |
| `Export X doesn't exist` | named export 누락 | `export function X()` 형태 확인 |
| NEXT WORKOUT 미표시 | 예정 세션이 과거 날짜 | `nextSession` nullable 처리 + 항상 렌더 |
| SET 배지 블롭 스타일 | 잘못된 배지 CSS | 52×52 다크 배지 + volt 테두리 스타일 적용 |
| KG/REPS 텍스트 겹침 | absolute 포지션 충돌 | flex 레이아웃으로 교체 |
| `pnpm dev` 오류 | 잘못된 폴더에서 실행 | `cd pt-app` 후 실행 |

---

## 📌 Claude Code 첫 시작 명령어

```
이 프로젝트는 CLAUDE_CODE_INSTRUCTIONS.md를 읽어줘.

신지용 트레이너 전용 PT 회원 관리 앱이야.
앞으로 내가 요청하는 작업을 직접 파일 수정하고
git add . → git commit → git push origin main 까지 자동으로 해줘.

커밋 메시지는 변경 내용을 한국어로 요약해서 써줘.
먼저 프로젝트 전체 구조를 파악해줘.
```

---

*Last updated: 2026-07-06 | PT Coach Pro v5.1*
