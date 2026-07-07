-- ════════════════════════════════════════════════════════════════
-- PT MEMBER v2 업그레이드
-- 사용법: Supabase SQL 편집기 → 새 쿼리 → 전체 복사 붙여넣기 → 실행
-- ════════════════════════════════════════════════════════════════

-- ─── 1. members 테이블에 성별/생년월일 컬럼 추가 ─────────────
alter table members
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists birth_date date;

-- 김민수: 남, 1995년생
update members
set gender = 'male', birth_date = '1995-05-12'
where id = '00000000-0000-0000-0000-000000000001';

-- 고예서: 여, 1998년생
update members
set gender = 'female', birth_date = '1998-08-23'
where id = '00000000-0000-0000-0000-000000000002';


-- ─── 2. benchmark_data 테이블 생성 ────────────────────────────
-- 트레이너가 관리하는 성별/연령대/종목별 평균 1RM 기준치
create table if not exists benchmark_data (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('male', 'female')),
  age_group text not null check (age_group in ('20s', '30s', '40s', '50s', '60+')),
  exercise_name text not null,
  beginner_kg numeric not null,
  intermediate_kg numeric not null,
  advanced_kg numeric not null,
  elite_kg numeric not null,
  created_at timestamptz default now(),
  unique (gender, age_group, exercise_name)
);

-- RLS 비활성화 (이전 테이블과 동일 정책)
alter table benchmark_data disable row level security;


-- ─── 3. 초기 벤치마크 데이터 (남 20대 / 여 20대 / 남 30대 / 여 30대) ─
-- 일반적인 헬스 표준치 참고. 트레이너가 본인 PT 데이터 누적되면 직접 조정.
-- 단위: kg (1RM 추정치)

-- 남성 20대 (3대 운동)
insert into benchmark_data (gender, age_group, exercise_name, beginner_kg, intermediate_kg, advanced_kg, elite_kg) values
  ('male', '20s', '벤치프레스', 60, 85, 110, 140),
  ('male', '20s', '스쿼트', 80, 110, 145, 180),
  ('male', '20s', '데드리프트', 100, 135, 175, 215),
  -- 상체
  ('male', '20s', '케이블 로우', 50, 70, 90, 115),
  ('male', '20s', '랫풀다운', 55, 75, 95, 120),
  ('male', '20s', '풀업머신', 50, 70, 95, 120),
  ('male', '20s', '체스트프레스', 55, 75, 100, 125),
  ('male', '20s', '숄더프레스', 35, 50, 70, 90),
  -- 하체
  ('male', '20s', '레그익스텐션', 50, 70, 90, 115),
  ('male', '20s', '레그컬', 40, 55, 75, 95),
  ('male', '20s', '힙어브덕션', 50, 70, 90, 115),
  ('male', '20s', '힙어덕션', 50, 70, 90, 115),
  ('male', '20s', '글루트머신', 80, 110, 140, 175),
  ('male', '20s', '레그프레스', 140, 195, 250, 320)
on conflict (gender, age_group, exercise_name) do nothing;

-- 여성 20대
insert into benchmark_data (gender, age_group, exercise_name, beginner_kg, intermediate_kg, advanced_kg, elite_kg) values
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
  ('female', '20s', '레그프레스', 80, 120, 160, 210)
on conflict (gender, age_group, exercise_name) do nothing;

-- 남성 30대 (20대 대비 약 90~95%)
insert into benchmark_data (gender, age_group, exercise_name, beginner_kg, intermediate_kg, advanced_kg, elite_kg) values
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
  ('male', '30s', '레그프레스', 130, 185, 240, 305)
on conflict (gender, age_group, exercise_name) do nothing;

-- 여성 30대
insert into benchmark_data (gender, age_group, exercise_name, beginner_kg, intermediate_kg, advanced_kg, elite_kg) values
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

-- ✅ 완료 — "반환된 행이 없습니다"가 정상입니다
