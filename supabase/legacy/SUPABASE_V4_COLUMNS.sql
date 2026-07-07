-- ════════════════════════════════════════════════════════════════
-- PT MEMBER v4 컬럼/테이블 추가
-- 실행: Supabase SQL 편집기 → 새 쿼리 → 전체 붙여넣기 → 실행
-- V3 SQL을 이미 실행했다면 이것만 추가로 실행하면 됩니다
-- ════════════════════════════════════════════════════════════════

-- ─── 1. members 테이블 컬럼 추가 ─────────────────────────────
alter table members
  add column if not exists trainer_assessment text,
  add column if not exists weekly_mission     text;

-- 초기값 (김민수 / 고예서)
update members
set
  trainer_assessment = '재활 관점에서 요추 안정성이 많이 향상됐습니다. 스쿼트 깊이에서 골반 틸팅이 줄었고, 데드리프트 시 흉추 신전도 눈에 띄게 좋아졌어요. 현재 진행 속도 유지가 핵심입니다.',
  weekly_mission     = '이번 주 핵심 미션: 스쿼트 세트 사이 복압 유지 3초 버티기 + 수면 7시간 이상'
where id = '00000000-0000-0000-0000-000000000001';

update members
set
  trainer_assessment = '힙힌지 패턴이 완전히 자리 잡혔습니다. 둔근 활성화 능력이 초기 대비 크게 향상됐고, 무릎 외반 문제도 거의 해결됐어요. 상체 견갑 안정성 강화가 다음 과제입니다.',
  weekly_mission     = '이번 주 핵심 미션: 힙 브릿지 매일 3×15 + 단백질 체중×1.5g 섭취 유지'
where id = '00000000-0000-0000-0000-000000000002';

-- ─── 2. body_measurements 테이블 생성 ────────────────────────
-- 트레이너가 회원 상세 화면에서 인바디 수치 직접 입력
create table if not exists body_measurements (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references members(id) on delete cascade,
  measured_at      date not null default current_date,
  weight_kg        numeric(5,1),  -- 체중 (kg)
  skeletal_muscle_kg numeric(4,1),-- 골격근량 (kg)
  body_fat_kg      numeric(4,1),  -- 체지방량 (kg)
  body_fat_pct     numeric(4,1),  -- 체지방률 (%)
  whr              numeric(4,3),  -- 복부지방률 (WHR, 예: 0.82)
  bmr_kcal         integer,       -- 기초대사량 (kcal)
  note             text,          -- 트레이너 메모
  created_at       timestamptz default now()
);
alter table body_measurements disable row level security;
create index if not exists idx_body_measurements_member
  on body_measurements(member_id, measured_at desc);

-- ─── 3. 더미 인바디 데이터 (김민수 — 남 30대) ────────────────
-- 3개월치 측정 이력 (2월~4월)
insert into body_measurements
  (member_id, measured_at, weight_kg, skeletal_muscle_kg, body_fat_kg, body_fat_pct, whr, bmr_kcal, note)
values
  ('00000000-0000-0000-0000-000000000001','2026-02-03',78.2,35.4,13.8,17.6,0.87,1820,'운동 시작 기준 측정'),
  ('00000000-0000-0000-0000-000000000001','2026-03-02',77.4,36.1,12.8,16.5,0.86,1835,'1개월 후 — 근육 +0.7kg, 지방 -1.0kg'),
  ('00000000-0000-0000-0000-000000000001','2026-04-01',76.8,37.0,11.5,15.0,0.84,1855,'2개월 후 — 근육 +1.6kg, 지방 -2.3kg'),
  ('00000000-0000-0000-0000-000000000001','2026-04-28',76.2,37.6,10.8,14.2,0.83,1868,'최근 측정 — 목표 체형 진입 중')
on conflict do nothing;

-- 더미 인바디 데이터 (고예서 — 여 20대)
insert into body_measurements
  (member_id, measured_at, weight_kg, skeletal_muscle_kg, body_fat_kg, body_fat_pct, whr, bmr_kcal, note)
values
  ('00000000-0000-0000-0000-000000000002','2026-02-04',58.5,22.1,14.2,24.3,0.77,1285,'운동 시작 기준 측정'),
  ('00000000-0000-0000-0000-000000000002','2026-03-03',57.8,22.7,13.4,23.2,0.76,1298,'1개월 후 — 근육 +0.6kg, 지방 -0.8kg'),
  ('00000000-0000-0000-0000-000000000002','2026-04-01',57.2,23.4,12.5,21.9,0.75,1315,'2개월 후 — 근육 +1.3kg, 지방 -1.7kg'),
  ('00000000-0000-0000-0000-000000000002','2026-04-28',56.8,23.9,11.8,20.8,0.74,1328,'최근 측정 — 건강 체중 진입')
on conflict do nothing;

-- ─── 4. 검증 ─────────────────────────────────────────────────
select m.name, m.trainer_assessment is not null as has_assessment,
       count(b.id) as body_records
from members m
left join body_measurements b on b.member_id = m.id
where m.id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
group by m.name, m.trainer_assessment;

-- ✅ 예상 결과:
-- 김민수: has_assessment=true, body_records=4
-- 고예서: has_assessment=true, body_records=4
