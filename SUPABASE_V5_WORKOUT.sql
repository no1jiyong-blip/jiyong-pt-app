-- ════════════════════════════════════════════════════════════════
-- PT MEMBER v5 — 개인 운동 컨디션 점수 컬럼 추가
-- 실행: Supabase SQL 편집기 → 새 쿼리 → 붙여넣기 → 실행
-- ════════════════════════════════════════════════════════════════

ALTER TABLE personal_logs
  ADD COLUMN IF NOT EXISTS condition_score SMALLINT CHECK (condition_score BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS workout_memo TEXT;

-- workout_memo: 카드 대표 메모 (예: "하체운동", "상체 집중")
-- condition_score: 컨디션 점수 1-10

-- ✅ 완료 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'personal_logs' 
  AND column_name IN ('condition_score', 'workout_memo');
