"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Sparkles, Target } from "lucide-react";
import type { Session, ExerciseRecord, SessionQuality } from "@/lib/types";
import { calcOneRM, EXERCISE_GROUPS } from "@/lib/types";
import { useMemo } from "react";

interface Props {
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  qualities: SessionQuality[];
}

export function MuscleBalanceRadar({
  sessions,
  recordsBySession,
  qualities,
}: Props) {
  const data = useMemo(() => {
    const completed = sessions.filter((s) => s.status === "completed");

    // 상체 1RM 평균 (케이블로우, 랫풀다운, 체스트프레스, 숄더프레스)
    const upperEx = EXERCISE_GROUPS.upper;
    const lowerEx = EXERCISE_GROUPS.lower;

    const byEx = new Map<string, number>();
    completed.forEach((s) => {
      const recs = recordsBySession[s.id] ?? [];
      recs.forEach((r) => {
        const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
        if (orm > 0) {
          const cur = byEx.get(r.exercise_name) ?? 0;
          if (orm > cur) byEx.set(r.exercise_name, orm);
        }
      });
    });

    // 최대값 기준으로 0~100 정규화
    const allValues = [...byEx.values()];
    const globalMax = allValues.length > 0 ? Math.max(...allValues) : 100;
    const norm = (v: number) => Math.round((v / globalMax) * 100);

    // 상체 점수: upperEx 평균
    const upperScores = upperEx
      .map((e) => byEx.get(e) ?? 0)
      .filter((v) => v > 0);
    const upperScore = upperScores.length > 0
      ? norm(upperScores.reduce((a, b) => a + b, 0) / upperScores.length)
      : 40;

    // 하체 점수
    const lowerScores = lowerEx
      .map((e) => byEx.get(e) ?? 0)
      .filter((v) => v > 0);
    const lowerScore = lowerScores.length > 0
      ? norm(lowerScores.reduce((a, b) => a + b, 0) / lowerScores.length)
      : 40;

    // 등 점수 (랫풀다운, 케이블로우)
    const backScores = ["랫풀다운", "케이블 로우"]
      .map((e) => byEx.get(e) ?? 0)
      .filter((v) => v > 0);
    const backScore = backScores.length > 0
      ? norm(backScores.reduce((a, b) => a + b, 0) / backScores.length)
      : 40;

    // 어깨 점수
    const shoulderScore = norm(byEx.get("숄더프레스") ?? 0) || 38;

    // 코어 점수: session_quality core_score 평균 × 10 (1-10 → 10-100)
    const coreScores = qualities
      .filter((q) => q.core_score !== null)
      .map((q) => (q.core_score ?? 5) * 10);
    const coreScore = coreScores.length > 0
      ? Math.round(coreScores.reduce((a, b) => a + b, 0) / coreScores.length)
      : 50;

    // 밸런스 점수: 좌우 점수 비율 (1에 가까울수록 100점)
    const balanceItems = qualities.filter(
      (q) => q.left_score !== null && q.right_score !== null
    );
    const avgBalance = balanceItems.length > 0
      ? balanceItems.reduce((acc, q) => {
          const l = q.left_score ?? 5;
          const r = q.right_score ?? 5;
          const ratio = Math.min(l, r) / Math.max(l, r);
          return acc + ratio;
        }, 0) / balanceItems.length
      : 0.85;
    const balanceScore = Math.round(avgBalance * 100);

    return [
      { axis: "상체", you: Math.min(100, upperScore + 10), target: 85 },
      { axis: "하체", you: Math.min(100, lowerScore + 12), target: 88 },
      { axis: "등", you: Math.min(100, backScore + 8), target: 82 },
      { axis: "어깨", you: Math.min(100, shoulderScore + 15), target: 78 },
      { axis: "코어", you: Math.min(100, coreScore), target: 80 },
      { axis: "밸런스", you: Math.min(100, balanceScore), target: 90 },
    ];
  }, [sessions, recordsBySession, qualities]);

  /* 종합 균형 등급 — 각 축의 '나' 점수가 목표 대비 얼마나 근접한지 평균 */
  const grade = useMemo(() => {
    const ratios = data.map((d) => d.you / d.target);
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (avg >= 1.05) return "A+";
    if (avg >= 0.95) return "A";
    if (avg >= 0.85) return "B+";
    if (avg >= 0.7) return "B";
    return "C";
  }, [data]);

  /* 가장 강한 축 / 목표 대비 가장 많이 부족한 축 */
  const { best, weak } = useMemo(() => {
    const sortedByScore = [...data].sort((a, b) => b.you - a.you);
    const sortedByGap = [...data].sort((a, b) => a.you - a.target - (b.you - b.target));
    return { best: sortedByScore[0], weak: sortedByGap[0] };
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full shrink-0"
              style={{ width: 6, height: 14, background: "var(--volt)", boxShadow: "0 0 8px var(--volt-glow-2)" }}
            />
            <h3 className="font-cond font-bold text-ink-0 tracking-widest uppercase leading-none" style={{ fontSize: 13 }}>
              MUSCLE BALANCE
            </h3>
          </div>
          <p className="text-[11px] font-cond text-ink-3 leading-none">
            상체·하체·등·어깨·코어·좌우 균형 지표
          </p>
        </div>
        <span
          className="font-cond font-bold px-2.5 py-1 rounded-full text-[10px] leading-none shrink-0 uppercase"
          style={{ background: "rgba(211,255,82,0.1)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }}
        >
          GRADE {grade}
        </span>
      </div>

      <div className="pt-card" style={{ padding: 20 }}>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid
              stroke="#2a2a2a"
              strokeDasharray="3 3"
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="axis"
              tick={({ x, y, payload, cx, cy }) => {
                // 중앙 대비 방향 계산
                const dx = x - cx;
                const dy = y - cy;
                const angle = Math.atan2(dy, dx);
                const offset = 14;
                return (
                  <text
                    x={x + Math.cos(angle) * offset}
                    y={y + Math.sin(angle) * offset}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#a0a0a0"
                    fontSize={10}
                    fontFamily="Barlow Condensed"
                    fontWeight={600}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            {/* 목표 라인 */}
            <Radar
              name="목표"
              dataKey="target"
              stroke="#5BA8FF"
              fill="#5BA8FF"
              fillOpacity={0.06}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            {/* 나의 기록 */}
            <Radar
              name="나"
              dataKey="you"
              stroke="#D3FF52"
              fill="#D3FF52"
              fillOpacity={0.22}
              strokeWidth={2.5}
              style={{
                filter: "drop-shadow(0 0 8px rgba(211,255,82,0.5))",
              }}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* 범례 */}
        <div className="flex justify-center gap-6 pt-3 border-t border-pt-5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: "#D3FF52", boxShadow: "0 0 6px rgba(211,255,82,0.6)" }} />
            <span className="text-[10px] font-cond text-volt font-bold">나</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: "#5BA8FF" }} />
            <span className="text-[10px] font-cond text-ink-2">목표</span>
          </div>
        </div>

        {/* 강점 / 보완 포인트 진단 */}
        <div className="grid grid-cols-2 gap-2.5 pt-4 mt-1" style={{ borderTop: "1px solid var(--pt-5)" }}>
          <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--volt-glow-2)" }}>
            <div className="flex items-center gap-1.5 mb-1 text-volt">
              <Sparkles size={13} />
              <span className="text-[9px] font-cond font-bold uppercase tracking-wider">BEST STRENGTH</span>
            </div>
            <p className="text-xs font-bold text-ink-0">{best.axis} ({best.you}점)</p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,140,0,0.3)" }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--warn)" }}>
              <Target size={13} />
              <span className="text-[9px] font-cond font-bold uppercase tracking-wider">FOCUS NEEDED</span>
            </div>
            <p className="text-xs font-bold text-ink-0">{weak.axis} ({weak.you}점)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
