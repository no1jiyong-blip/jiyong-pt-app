-- ════════════════════════════════════════════════════════════════
-- PT Coach Pro — 최종 통합 스키마 (Final Consolidated Schema)
--
-- 기존에 흩어져 있던 SUPABASE_FINAL / V2 / V3 / V4 / V5 SQL을 전부
-- 합쳐서, 한 번만 실행하면 되는 최종 버전으로 정리한 파일입니다.
--
-- 이미 일부 테이블/컬럼이 존재해도, 존재하지 않아도 안전하게
-- 반복 실행할 수 있도록 전부 IF NOT EXISTS 로 작성했습니다.
-- (즉, 여러 번 실행해도 데이터가 지워지거나 에러가 나지 않습니다)
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── 1. members : 회원 정보 ───────────────────────────────────
create table if not exists members (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text,
  goal                text,
  start_date          date,
  session_start_date  date,
  total_sessions      integer default 0,
  used_sessions       integer default 0,
  notes               text,
  gender              text check (gender in ('male', 'female')),
  birth_date          date,
  trainer_assessment  text,
  weekly_mission      text,
  created_at          timestamptz default now()
);
alter table members add column if not exists gender text check (gender in ('male', 'female'));
alter table members add column if not exists birth_date date;
alter table members add column if not exists trainer_assessment text;
alter table members add column if not exists weekly_mission text;
alter table members disable row level security;

-- ─── 2. users : 로그인 계정 ────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  username    text not null unique,
  password    text not null,
  role        text not null check (role in ('trainer', 'member')),
  member_id   uuid references members(id) on delete cascade,
  created_at  timestamptz default now()
);
alter table users disable row level security;

-- ─── 3. sessions : PT 수업 일정/기록 ───────────────────────────
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references members(id) on delete cascade,
  session_number  integer,
  date            date not null,
  time            text,
  status          text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  title           text,
  trainer_note    text,
  feedback        text,
  video_url       text,
  created_at      timestamptz default now()
);
alter table sessions add column if not exists video_url text;
alter table sessions disable row level security;
create index if not exists idx_sessions_member on sessions(member_id, date desc);

-- ─── 4. exercise_records : 수업별 운동 기록 ────────────────────
create table if not exists exercise_records (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  exercise_name  text not null,
  weight         numeric,
  reps           integer,
  sets           integer,
  description    text,
  created_at     timestamptz default now()
);
alter table exercise_records add column if not exists description text;
alter table exercise_records disable row level security;
create index if not exists idx_exercise_records_session on exercise_records(session_id);

-- ─── 5. homework : 이주의 숙제 ─────────────────────────────────
create table if not exists homework (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members(id) on delete cascade,
  week_start    date not null,
  content       text not null,
  is_completed  boolean not null default false,
  created_at    timestamptz default now()
);
alter table homework disable row level security;
create index if not exists idx_homework_member on homework(member_id, week_start desc);

-- ─── 6. personal_logs : 회원 개인 운동 일지 ────────────────────
create table if not exists personal_logs (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references members(id) on delete cascade,
  log_date          date not null,
  exercise_name     text not null,
  reps              integer,
  sets              integer,
  memo              text,
  workout_memo      text,
  condition_score   smallint check (condition_score between 1 and 10),
  created_at        timestamptz default now()
);
alter table personal_logs add column if not exists workout_memo text;
alter table personal_logs add column if not exists condition_score smallint check (condition_score between 1 and 10);
alter table personal_logs disable row level security;
create index if not exists idx_personal_logs_member on personal_logs(member_id, log_date desc);

-- ─── 7. benchmark_data : ACSM 성별/연령별 1RM 벤치마크 ─────────
create table if not exists benchmark_data (
  id                  uuid primary key default gen_random_uuid(),
  gender              text not null check (gender in ('male', 'female')),
  age_group           text not null check (age_group in ('20s', '30s', '40s', '50s', '60+')),
  exercise_name       text not null,
  beginner_kg         numeric not null,
  intermediate_kg     numeric not null,
  advanced_kg         numeric not null,
  elite_kg            numeric not null,
  core_ratio_target   numeric default 0.35,
  balance_threshold   numeric default 0.90,
  created_at          timestamptz default now(),
  unique (gender, age_group, exercise_name)
);
alter table benchmark_data add column if not exists core_ratio_target numeric default 0.35;
alter table benchmark_data add column if not exists balance_threshold numeric default 0.90;
alter table benchmark_data disable row level security;

-- ─── 8. session_quality : 코어/밸런스 점수 (트레이너 입력) ─────
create table if not exists session_quality (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  core_score    integer check (core_score between 1 and 10),
  left_score    integer check (left_score between 1 and 10),
  right_score   integer check (right_score between 1 and 10),
  balance_note  text,
  created_at    timestamptz default now(),
  unique (session_id)
);
alter table session_quality disable row level security;

-- ─── 9. body_measurements : 인바디 측정 이력 ───────────────────
create table if not exists body_measurements (
  id                   uuid primary key default gen_random_uuid(),
  member_id            uuid not null references members(id) on delete cascade,
  measured_at          date not null default current_date,
  weight_kg            numeric(5,1),
  skeletal_muscle_kg   numeric(4,1),
  body_fat_kg          numeric(4,1),
  body_fat_pct         numeric(4,1),
  whr                  numeric(4,3),
  bmr_kcal             integer,
  note                 text,
  created_at           timestamptz default now()
);
alter table body_measurements disable row level security;
create index if not exists idx_body_measurements_member on body_measurements(member_id, measured_at desc);

-- ════════════════════════════════════════════════════════════════
-- 10. ACSM 벤치마크 기준값 시딩 (실제 서비스 로직에 필요한 참조 데이터,
--     회원 더미 데이터 아님 — 근력 비교 차트가 이 값을 기준으로 동작합니다)
-- ════════════════════════════════════════════════════════════════
insert into benchmark_data (gender, age_group, exercise_name, beginner_kg, intermediate_kg, advanced_kg, elite_kg) values
  ('male', '20s', '벤치프레스', 60, 85, 110, 140),
  ('male', '20s', '스쿼트', 80, 110, 145, 180),
  ('male', '20s', '데드리프트', 100, 135, 175, 215),
  ('male', '20s', '케이블 로우', 50, 70, 90, 115),
  ('male', '20s', '랫풀다운', 55, 75, 95, 120),
  ('male', '20s', '풀업머신', 50, 70, 95, 120),
  ('male', '20s', '체스트프레스', 55, 75, 100, 125),
  ('male', '20s', '숄더프레스', 35, 50, 70, 90),
  ('male', '20s', '레그익스텐션', 50, 70, 90, 115),
  ('male', '20s', '레그컬', 40, 55, 75, 95),
  ('male', '20s', '힙어브덕션', 50, 70, 90, 115),
  ('male', '20s', '힙어덕션', 50, 70, 90, 115),
  ('male', '20s', '글루트머신', 80, 110, 140, 175),
  ('male', '20s', '레그프레스', 140, 195, 250, 320),
  ('female', '20s', '벤치프레스', 25, 40, 55, 70),
  ('female', '20s', '스쿼트', 40, 60, 80, 105),
  ('female', '20s', '데드리프트', 50, 75, 100, 130),
  ('female', '20s', '케이블 로우', 25, 40, 55, 70),
  ('female', '20s', '랫풀다운', 25, 40, 55, 70),
  ('female', '20s', '풀업머신', 25, 40, 60, 75),
  ('female', '20s', '체스트프레스', 25, 40, 55, 70),
  ('female', '20s', '숄더프레스', 15, 25, 40, 55),
  ('female', '20s', '레그익스텐션', 25, 40, 55, 70),
  ('female', '20s', '레그컬', 20, 30, 45, 60),
  ('female', '20s', '힙어브덕션', 30, 45, 65, 80),
  ('female', '20s', '힙어덕션', 30, 45, 65, 80),
  ('female', '20s', '글루트머신', 50, 75, 100, 130),
  ('female', '20s', '레그프레스', 80, 120, 160, 210),
  ('male', '30s', '벤치프레스', 55, 80, 105, 130),
  ('male', '30s', '스쿼트', 75, 105, 135, 170),
  ('male', '30s', '데드리프트', 95, 130, 165, 200),
  ('male', '30s', '케이블 로우', 50, 65, 85, 110),
  ('male', '30s', '랫풀다운', 50, 70, 90, 115),
  ('male', '30s', '풀업머신', 45, 65, 90, 115),
  ('male', '30s', '체스트프레스', 50, 70, 95, 120),
  ('male', '30s', '숄더프레스', 32, 47, 65, 85),
  ('male', '30s', '레그익스텐션', 47, 65, 85, 108),
  ('male', '30s', '레그컬', 38, 52, 70, 90),
  ('male', '30s', '힙어브덕션', 47, 65, 85, 108),
  ('male', '30s', '힙어덕션', 47, 65, 85, 108),
  ('male', '30s', '글루트머신', 75, 105, 135, 165),
  ('male', '30s', '레그프레스', 130, 185, 240, 305),
  ('female', '30s', '벤치프레스', 22, 37, 52, 65),
  ('female', '30s', '스쿼트', 37, 57, 75, 100),
  ('female', '30s', '데드리프트', 47, 70, 95, 122),
  ('female', '30s', '케이블 로우', 22, 37, 52, 65),
  ('female', '30s', '랫풀다운', 22, 37, 52, 65),
  ('female', '30s', '풀업머신', 22, 37, 55, 70),
  ('female', '30s', '체스트프레스', 22, 37, 52, 65),
  ('female', '30s', '숄더프레스', 14, 22, 37, 50),
  ('female', '30s', '레그익스텐션', 22, 37, 52, 65),
  ('female', '30s', '레그컬', 18, 27, 42, 55),
  ('female', '30s', '힙어브덕션', 27, 42, 60, 75),
  ('female', '30s', '힙어덕션', 27, 42, 60, 75),
  ('female', '30s', '글루트머신', 47, 70, 95, 122),
  ('female', '30s', '레그프레스', 75, 113, 150, 195)
on conflict (gender, age_group, exercise_name) do nothing;

-- ════════════════════════════════════════════════════════════════
-- 11. 트레이너 최초 로그인 계정 부트스트랩
--     (더미 데이터 아님 — 이게 없으면 아무도 로그인할 수 없습니다.
--      최초 실행 후 앱에 로그인해서 반드시 비밀번호를 변경하세요)
-- ════════════════════════════════════════════════════════════════
insert into users (username, password, role)
values ('admin', 'admin', 'trainer')
on conflict (username) do nothing;

-- ─── 12. 검증 ──────────────────────────────────────────────────
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'members','users','sessions','exercise_records','homework',
    'personal_logs','benchmark_data','session_quality','body_measurements'
  )
order by table_name;
-- ✅ 위 9개 테이블이 전부 나오면 정상입니다.
