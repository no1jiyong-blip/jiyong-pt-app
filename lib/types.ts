/* ════════════════════════════════════════════════════════════
   PT MEMBER · 데이터 타입 + 비즈니스 로직
   ════════════════════════════════════════════════════════════ */

export interface User {
  id: string;
  username: string;
  password: string;
  role: "trainer" | "member";
  member_id: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string | null;
  goal: string | null;
  start_date: string | null;
  session_start_date: string | null;
  total_sessions: number;
  used_sessions: number;
  notes: string | null;
  gender: "male" | "female" | null;
  birth_date: string | null;
  trainer_assessment: string | null;
  weekly_mission: string | null;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  member_id: string;
  measured_at: string;
  weight_kg: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_kg: number | null;
  body_fat_pct: number | null;
  whr: number | null;
  bmr_kcal: number | null;
  note: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  member_id: string;
  session_number: number | null;
  date: string;
  time: string | null;
  status: "scheduled" | "completed" | "cancelled";
  title: string | null;
  trainer_note: string | null;
  feedback: string | null;
  video_url: string | null;
  created_at: string;
}

export interface ExerciseRecord {
  id: string;
  session_id: string;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  sets: number | null;
  description: string | null;
  created_at: string;
}

export interface Homework {
  id: string;
  member_id: string;
  week_start: string;
  content: string;
  is_completed: boolean;
  created_at: string;
}

export interface PersonalLog {
  id: string;
  member_id: string;
  log_date: string;
  exercise_name: string;
  reps: number | null;
  sets: number | null;
  memo: string | null;
  workout_memo: string | null;   // 카드 대표 메모 (예: 하체운동)
  condition_score: number | null; // 컨디션 1-10
  created_at: string;
}

export interface BenchmarkData {
  id: string;
  gender: "male" | "female";
  age_group: "20s" | "30s" | "40s" | "50s" | "60+";
  exercise_name: string;
  beginner_kg: number;
  intermediate_kg: number;
  advanced_kg: number;
  elite_kg: number;
  core_ratio_target?: number;  // 3대 운동 대비 코어 목표 비율 (기본 0.35)
  balance_threshold?: number;  // 좌우 균형 임계값 (기본 0.90)
}

export interface SessionQuality {
  id: string;
  session_id: string;
  core_score: number | null;     // 1-10: 높을수록 자세 유지 잘됨
  left_score: number | null;     // 1-10: 좌측 근력
  right_score: number | null;    // 1-10: 우측 근력
  balance_note: string | null;   // 트레이너 코멘트
  created_at: string;
}


/* ─── Brzycki 1RM 공식 ─────────────────────────── */
export function calcOneRM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  if (reps >= 37) return Math.round(weight);
  return Math.round(weight * (36 / (37 - reps)));
}


/* ─── 운동 종목 카테고리 (v2 정식 체계) ──────────── */
export const EXERCISE_GROUPS = {
  big3: ["스쿼트", "데드리프트", "벤치프레스"],
  upper: [
    "케이블 로우",
    "랫풀다운",
    "풀업머신",
    "체스트프레스",
    "숄더프레스",
  ],
  lower: [
    "레그익스텐션",
    "레그컬",
    "힙어브덕션",
    "힙어덕션",
    "글루트머신",
    "레그프레스",
  ],
} as const;

export type ExerciseGroupKey = keyof typeof EXERCISE_GROUPS;

export const EXERCISE_GROUP_LABELS: Record<ExerciseGroupKey, string> = {
  big3: "3대 운동",
  upper: "상체 운동",
  lower: "하체 운동",
};

/* 모든 운동 종목 평면 리스트 (드롭다운/입력용) */
export const ALL_EXERCISES: readonly string[] = [
  ...EXERCISE_GROUPS.big3,
  ...EXERCISE_GROUPS.upper,
  ...EXERCISE_GROUPS.lower,
];


/* ─── 연령대 계산 ──────────────────────────────── */
export function getAgeGroup(birthDate: string | null): BenchmarkData["age_group"] | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60+";
}

export function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
