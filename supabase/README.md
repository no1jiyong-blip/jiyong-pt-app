# Supabase 스키마

**`schema.sql`** 하나만 실행하면 됩니다. 기존에 흩어져 있던
`SUPABASE_FINAL.sql`, `SUPABASE_V2~V5.sql`, `SUPABASE_DUMMY_DATA.sql`을
전부 분석해서 최신 상태로 합친 최종본입니다. (예전 파일들은 `legacy/`
폴더에 기록용으로만 남겨뒀습니다 — 더 이상 실행할 필요 없습니다)

## 실행 방법

1. Supabase 대시보드 → 해당 프로젝트 → **SQL Editor** → 새 쿼리
2. `schema.sql` 전체 내용을 붙여넣고 **Run**
3. 여러 번 실행해도 안전합니다 (전부 `IF NOT EXISTS` 처리됨 — 데이터 삭제 없음)

## 포함된 테이블 (9개)

`members`, `users`, `sessions`, `exercise_records`, `homework`,
`personal_logs`, `benchmark_data`, `session_quality`, `body_measurements`

## 포함된 시드 데이터

- ACSM 성별/연령별 1RM 벤치마크 기준값 (남/여 20대·30대) — 근력 비교 차트가
  실제로 참조하는 값이라 반드시 필요합니다.
- 트레이너 최초 로그인 계정 (`admin` / `admin`) — 로그인할 계정이 하나도
  없으면 앱에 아예 들어갈 수 없어서 넣어둔 부트스트랩용 계정입니다.
  **최초 로그인 후 반드시 비밀번호를 바꾸세요.**

회원(멤버) 데이터는 더 이상 SQL로 심지 않습니다 — 트레이너 화면의
"회원 추가" 기능으로 실제 회원을 등록하면 됩니다.
