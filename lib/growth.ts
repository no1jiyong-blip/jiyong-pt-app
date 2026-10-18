/* ════════════════════════════════════════════════════════════
   GROWTH 탭 전용 — 여러 컴포넌트가 공유하는 순수 계산 함수 모음
   (전부 실데이터 기반, 임의/가짜 수치 없음)
   ════════════════════════════════════════════════════════════ */

import type { Session, ExerciseRecord } from "./types";
import { calcOneRM } from "./types";

/** 종목 하나의 PR(자기 기록) 추이 — 등록 시점 대비 성장 계산에 사용 */
export interface PRPoint {
  date: string;
  weight: number;
  reps: number;
  orm: number;
}

export function computeOneRMProgress(
  exerciseName: string,
  sessions: Session[],
  recordsBySession: Record<string, ExerciseRecord[]>
): { first: PRPoint | null; latest: PRPoint | null; previous: PRPoint | null } {
  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.date.localeCompare(b.date));

  const prPoints: PRPoint[] = [];
  let prevMax = 0;

  completed.forEach((s) => {
    const recs = (recordsBySession[s.id] ?? []).filter((r) => r.exercise_name === exerciseName);
    if (recs.length === 0) return;

    let bestRec: ExerciseRecord | null = null;
    let bestORM = 0;
    recs.forEach((r) => {
      const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
      if (orm > bestORM) {
        bestORM = orm;
        bestRec = r;
      }
    });
    if (!bestRec || bestORM <= 0) return;

    if (bestORM > prevMax) {
      prevMax = bestORM;
      prPoints.push({
        date: s.date,
        weight: (bestRec as ExerciseRecord).weight ?? 0,
        reps: (bestRec as ExerciseRecord).reps ?? 0,
        orm: Math.round(bestORM),
      });
    }
  });

  return {
    first: prPoints[0] ?? null,
    latest: prPoints[prPoints.length - 1] ?? null,
    previous: prPoints[prPoints.length - 2] ?? null,
  };
}

/** 완료된 모든 세션의 운동 기록을 합산한 누적 훈련 볼륨 (톤) — weight × reps × sets */
export function computeTrainingVolumeTons(
  sessions: Session[],
  recordsBySession: Record<string, ExerciseRecord[]>
): number {
  const completedIds = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.id));
  let totalKg = 0;
  completedIds.forEach((id) => {
    (recordsBySession[id] ?? []).forEach((r) => {
      totalKg += (r.weight ?? 0) * (r.reps ?? 0) * (r.sets ?? 1);
    });
  });
  return Math.round((totalKg / 1000) * 10) / 10;
}

/** 전체 평균 퍼센타일(0~100)을 등급 레이블로 변환 */
export function computeTier(avgPercentile: number): { label: string; sub: "I" | "II" } {
  const bands: { min: number; max: number; label: string }[] = [
    { min: 0, max: 25, label: "NOVICE" },
    { min: 25, max: 50, label: "BEGINNER" },
    { min: 50, max: 75, label: "INTERMEDIATE" },
    { min: 75, max: 90, label: "ADVANCED" },
    { min: 90, max: 100, label: "ELITE" },
  ];
  const band = bands.find((b) => avgPercentile >= b.min && avgPercentile < b.max) ?? bands[bands.length - 1];
  const posInBand = (avgPercentile - band.min) / Math.max(1, band.max - band.min);
  return { label: band.label, sub: posInBand >= 0.5 ? "II" : "I" };
}
