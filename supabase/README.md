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
- `users` 테이블에 `admin` 행이 하나 들어가지만, 이것만으로는 로그인이 안
  됩니다 (아래 "인증 설정" 참고).

회원(멤버) 데이터는 더 이상 SQL로 심지 않습니다 — 트레이너 화면의
"회원 추가" 기능으로 실제 회원을 등록하면 됩니다.

## 인증 설정 (schema.sql 실행 후, 완전히 새로 만드는 프로젝트인 경우만)

로그인은 Supabase Auth 기반이라, `schema.sql`만으로는 트레이너 계정으로
로그인할 수 없습니다. 아래 과정이 한 번 더 필요합니다:

1. Supabase 대시보드 → **Authentication → Users → Add user**
2. Email: `admin@ptcoachpro.internal`, Password: 원하는 비밀번호 입력,
   "Auto Confirm User" 체크
3. 생성된 사용자의 UUID를 복사
4. SQL Editor에서 실행:
   ```sql
   update users set id = '방금 복사한 UUID' where username = 'admin';
   ```
5. 이제 `admin` / (2번에서 정한 비밀번호)로 로그인 가능

이미 운영 중인 이 프로젝트는 이 과정을 완료한 상태입니다 — 새로 프로젝트를
만들 때만 필요한 절차입니다.

## RLS 정책 (`rls-policies.sql`)

**반드시 위 인증 설정까지 끝내고, 앱이 Supabase Auth 기반으로 정상 로그인
되는 걸 확인한 다음에 실행하세요.** 순서를 지키지 않으면 로그인 자체가
막힐 수 있습니다. 트레이너는 전체 테이블 접근, 회원은 자기 `member_id`에
연결된 데이터만 접근하도록 9개 테이블에 RLS를 겁니다.
