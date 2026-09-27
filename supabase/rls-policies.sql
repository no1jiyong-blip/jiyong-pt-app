-- ════════════════════════════════════════════════════════════════
-- PT Coach Pro — RLS (Row Level Security) 정책
--
-- ⚠️ 반드시 아래 순서를 지켜서 실행하세요:
--   1. 앱 코드가 Supabase Auth 기반으로 전환 배포된 것을 먼저 확인
--   2. 그 다음에만 이 스크립트 실행 (그전에 실행하면 기존 평문 비밀번호
--      로그인 방식이 즉시 막혀서 아무도 로그인 못 하게 됩니다)
--
-- 원칙:
--   - 트레이너(role='trainer')는 모든 테이블 전체 접근
--   - 회원(role='member')은 자기 자신의 데이터만 조회 가능
--   - 회원이 직접 쓰는(insert/update) 테이블만 회원 쓰기 권한 부여
--     (personal_logs: 개인 운동 기록 작성, homework: 완료 체크)
-- ════════════════════════════════════════════════════════════════

-- ─── 헬퍼 함수 (RLS 정책 안에서 users 테이블을 조회할 때, users 테이블
--      자체도 RLS가 걸려있어 재귀 문제가 생기는 것을 막기 위해
--      security definer로 우회) ───────────────────────────────────
create or replace function auth_role() returns text
language sql stable security definer
set search_path = public
as $$
  select role from users where id = auth.uid();
$$;

create or replace function auth_member_id() returns uuid
language sql stable security definer
set search_path = public
as $$
  select member_id from users where id = auth.uid();
$$;

-- ─── 1. users : 본인 프로필만 조회 ─────────────────────────────
alter table users enable row level security;
drop policy if exists "본인 프로필 조회" on users;
create policy "본인 프로필 조회" on users
  for select using (id = auth.uid());

-- ─── 2. members ────────────────────────────────────────────────
alter table members enable row level security;
drop policy if exists "트레이너 전체 접근" on members;
create policy "트레이너 전체 접근" on members
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 정보 조회" on members;
create policy "회원 본인 정보 조회" on members
  for select using (id = auth_member_id());

-- ─── 3. sessions ───────────────────────────────────────────────
alter table sessions enable row level security;
drop policy if exists "트레이너 전체 접근" on sessions;
create policy "트레이너 전체 접근" on sessions
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 세션 조회" on sessions;
create policy "회원 본인 세션 조회" on sessions
  for select using (member_id = auth_member_id());

-- ─── 4. exercise_records (session_id로 연결) ───────────────────
alter table exercise_records enable row level security;
drop policy if exists "트레이너 전체 접근" on exercise_records;
create policy "트레이너 전체 접근" on exercise_records
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 기록 조회" on exercise_records;
create policy "회원 본인 기록 조회" on exercise_records
  for select using (
    exists (
      select 1 from sessions s
      where s.id = exercise_records.session_id and s.member_id = auth_member_id()
    )
  );

-- ─── 5. homework (회원이 완료 체크 가능) ───────────────────────
alter table homework enable row level security;
drop policy if exists "트레이너 전체 접근" on homework;
create policy "트레이너 전체 접근" on homework
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 숙제 조회" on homework;
create policy "회원 본인 숙제 조회" on homework
  for select using (member_id = auth_member_id());
drop policy if exists "회원 본인 숙제 완료체크" on homework;
create policy "회원 본인 숙제 완료체크" on homework
  for update using (member_id = auth_member_id()) with check (member_id = auth_member_id());

-- ─── 6. personal_logs (회원 본인 운동일지, 직접 작성) ──────────
alter table personal_logs enable row level security;
drop policy if exists "트레이너 전체 접근" on personal_logs;
create policy "트레이너 전체 접근" on personal_logs
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 일지 조회" on personal_logs;
create policy "회원 본인 일지 조회" on personal_logs
  for select using (member_id = auth_member_id());
drop policy if exists "회원 본인 일지 작성" on personal_logs;
create policy "회원 본인 일지 작성" on personal_logs
  for insert with check (member_id = auth_member_id());

-- ─── 7. benchmark_data (기준값 참조 데이터, 전체 읽기 전용) ────
alter table benchmark_data enable row level security;
drop policy if exists "트레이너 전체 접근" on benchmark_data;
create policy "트레이너 전체 접근" on benchmark_data
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "로그인 사용자 전체 조회" on benchmark_data;
create policy "로그인 사용자 전체 조회" on benchmark_data
  for select using (auth.uid() is not null);

-- ─── 8. session_quality (session_id로 연결) ────────────────────
alter table session_quality enable row level security;
drop policy if exists "트레이너 전체 접근" on session_quality;
create policy "트레이너 전체 접근" on session_quality
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 품질기록 조회" on session_quality;
create policy "회원 본인 품질기록 조회" on session_quality
  for select using (
    exists (
      select 1 from sessions s
      where s.id = session_quality.session_id and s.member_id = auth_member_id()
    )
  );

-- ─── 9. body_measurements (트레이너가 입력, 회원은 조회만) ─────
alter table body_measurements enable row level security;
drop policy if exists "트레이너 전체 접근" on body_measurements;
create policy "트레이너 전체 접근" on body_measurements
  for all using (auth_role() = 'trainer') with check (auth_role() = 'trainer');
drop policy if exists "회원 본인 인바디 조회" on body_measurements;
create policy "회원 본인 인바디 조회" on body_measurements
  for select using (member_id = auth_member_id());

-- ─── 검증 ──────────────────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'members','users','sessions','exercise_records','homework',
    'personal_logs','benchmark_data','session_quality','body_measurements'
  )
order by tablename;
-- ✅ 위 9개 테이블 전부 rowsecurity = true 면 정상입니다.
