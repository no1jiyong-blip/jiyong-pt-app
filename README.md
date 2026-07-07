# PT MEMBER · v4 (4탭 시스템)

> 회원 화면 → **Home / Workout / Growth / Mission** 4탭 구조
> 트레이너 화면, Supabase 연동, 디자인은 모두 그대로 유지

---

## 🚨 기존에 v3 SQL을 안 돌리셨다면 먼저 실행

이미 v3에서 `SUPABASE_V2_UPGRADE.sql`을 실행하셨다면 **추가 SQL 작업은 없습니다.**

안 했다면 ZIP 안의 `SUPABASE_V2_UPGRADE.sql`을 Supabase SQL 편집기에서 한 번 실행해주세요.

---

## ✨ v4 핵심 변경 — 4탭 시스템

### 🏠 Home 탭
- **잔여 세션 카드** Volt Green 글로우 펄스 (5회 이하 시 경고, 3회 이하 시 빨간 펄스)
- 진행률 바
- 다음 PT 수업 + 트레이너의 운동 계획 미리보기
- 트레이너 한마디 (가장 최근 피드백)

### 💪 Workout 탭
- **오늘의 PT 운동 (보기 전용)** — 트레이너가 입력한 내용만 표시
- **휴식 타이머** — 60/90/120/180초 프리셋, 진동 알림, ±15초 조절
- **개인 운동 일지 (직접 입력)**
  - 세트별 [무게/횟수] 개별 입력란
  - **이전 세트 복사** 버튼
  - 종목 자동완성 (13개 종목)
  - 세트 입력 중 PB(개인 최고) 깨면 → **입력란 형광 강조**
  - 저장 시 PB 신기록 → **형광 컨페티 70개 + 토스트 알림**
  - **RPE 1-10 슬라이더** (강도 표시 + 색상 그라데이션)

### 📈 Growth 탭
- **Global Benchmark 패널 (NEW!)**
  - 거대한 **TOP X%** 발광 텍스트
  - 가로 게이지 + 펄싱 마커 ("South Korea Males 30s" 표시)
  - 3대 운동 비교 카드 (Squat=Volt / Deadlift=Blue / Bench=White) + 미니 sparkline
  - **VS. AVERAGE +Xkg** 비교
  - **NEXT MILESTONE** 카드 ("BREAK INTO TOP 10%" + 종목별 +Xkg 목표)
  - **GO TO WORKOUT PLAN** CTA → Workout 탭으로 즉시 이동
- 1RM 추이 차트 — 종목별 색상 구분, **Y축 동적 (현재 기록의 120%)** 우상향 유도
- 기존 5단계 막대 벤치마크

### 🎯 Mission 탭
- 이주의 숙제 체크리스트
- 숙제 완료 시 카드 전체에 **은은한 형광 테두리** 활성화
- 모두 완료 시 "🔥 모두 완료!" 배지
- 식단 & 라이프스타일 가이드 (단백질 / 수분 / 수면)

---

## 🎨 디자인 시스템 추가 사항
- **Glassmorphism 하단 탭바** (80% opacity + backdrop-blur)
- **햅틱 탭 애니메이션** — 모든 버튼 클릭 시 미세 축소
- **탭 전환 슬라이드** — 부드러운 좌측 슬라이드 인
- **글로우 펄스** — 잔여 세션 5회 이하 시
- **위험 펄스** (빨강) — 잔여 세션 3회 이하 시

---

## 🔐 테스트 계정

| 역할 | 아이디 | 비밀번호 |
|------|-------|---------|
| 트레이너 | `admin` | `admin` |
| 김민수 (남, 30대) | `minsu` | `1234` |
| 고예서 (여, 20대) | `yeseo` | `1234` |

---

## 🚀 배포

GitHub → Vercel 절차 동일. 환경변수 그대로:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yzyazinkoqagyjtinsip.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_0NYYic-3L7aOg4VH650SNg_LKnLOR6E` |

기존에 배포된 게 있으면 GitHub에 push만 하면 자동 재배포됩니다.

---

## 📐 보존된 것들

기존에 만든 모든 것이 그대로 살아있습니다:
- 트레이너 화면 (스케줄 관리, 회원 상세)
- Supabase 연동 (실시간 동기화)
- 모든 기존 컴포넌트 (StatsCards, SessionScheduleCard, BenchmarkChart, ...)
- 디자인 시스템 (그라데이션, p-8 카드, Slate 차트 톤)

회원 화면만 4탭 구조로 재배치되었습니다.
