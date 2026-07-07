"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
  ReferenceDot,
} from "recharts";
import { Trophy, Target } from "lucide-react";
import {
  EXERCISE_GROUPS,
  EXERCISE_GROUP_LABELS,
  type ExerciseGroupKey,
  type Session,
  type ExerciseRecord,
  type BenchmarkData,
  calcOneRM,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  benchmarks: BenchmarkData[];
}

const COLOR_BY_EX: Record<string, string> = {
  스쿼트: "#D3FF52",
  데드리프트: "#5BA8FF",
  벤치프레스: "#E8E8E8",
};
const SLATE_FALLBACK = ["#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155"];

export function StrengthProgressChart({
  sessions,
  recordsBySession,
  benchmarks,
}: Props) {
  const [tab, setTab] = useState<ExerciseGroupKey>("big3");
  const exercises = EXERCISE_GROUPS[tab];

  const getColor = (ex: string, idx: number) =>
    COLOR_BY_EX[ex] ?? SLATE_FALLBACK[idx] ?? "#94a3b8";

  /* 종목별 차트 데이터 — 하나의 종목씩 분리해서 분석 */
  const charts = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    return exercises
      .map((ex, idx) => {
        const points: { date: string; orm: number; isPR: boolean }[] = [];
        let prevMax = 0;

        completed.forEach((s) => {
          const recs = recordsBySession[s.id] ?? [];
          const matching = recs.filter((r) => r.exercise_name === ex);
          if (matching.length === 0) return;
          const maxORM = Math.max(
            ...matching.map((r) => calcOneRM(r.weight ?? 0, r.reps ?? 0))
          );
          if (maxORM <= 0) return;
          const dateLabel = `${s.date.slice(5, 7)}/${s.date.slice(8, 10)}`;
          const isPR = maxORM > prevMax;
          if (isPR) prevMax = maxORM;
          points.push({ date: dateLabel, orm: maxORM, isPR });
        });

        // Ghost Runner = advanced_kg (평행선)
        const bench = benchmarks.find((b) => b.exercise_name === ex);
        const ghostKg = bench?.advanced_kg ?? null;

        // 미래 예측: 마지막 2-3개 데이터로 선형 회귀
        let projectionPoints: { date: string; orm: number; projection?: number }[] = [];
        if (points.length >= 3) {
          // 단순 선형 회귀 (최근 추세)
          const recent = points.slice(-Math.min(5, points.length));
          const n = recent.length;
          const xs = recent.map((_, i) => i);
          const ys = recent.map((p) => p.orm);
          const xMean = xs.reduce((a, b) => a + b, 0) / n;
          const yMean = ys.reduce((a, b) => a + b, 0) / n;
          const slope =
            xs.reduce(
              (acc, x, i) => acc + (x - xMean) * (ys[i] - yMean),
              0
            ) /
            (xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0) || 1);

          const lastPoint = points[points.length - 1];
          const lastORM = lastPoint.orm;

          // 4주 후 예측 (4 데이터 포인트)
          projectionPoints = [
            ...points.map((p) => ({
              date: p.date,
              orm: p.orm,
              projection: undefined as number | undefined,
            })),
          ];
          // 예측 시점은 lastORM부터 시작
          for (let i = 1; i <= 3; i++) {
            const futureOrm = Math.max(lastORM, Math.round(lastORM + slope * i));
            projectionPoints.push({
              date: `+${i * 2}주`,
              orm: NaN as unknown as number, // 실선 안 그리기
              projection: futureOrm,
            });
          }
          // 마지막 실제 포인트에 projection도 같이 (선이 자연스럽게 이어지도록)
          if (projectionPoints.length > 0) {
            const lastIdx = points.length - 1;
            projectionPoints[lastIdx].projection = points[lastIdx].orm;
          }
        } else {
          projectionPoints = points.map((p) => ({
            date: p.date,
            orm: p.orm,
            projection: undefined,
          }));
        }

        // Y축 동적 (최대값의 120%)
        const allValues = [
          ...points.map((p) => p.orm),
          ...(ghostKg ? [ghostKg] : []),
        ];
        const max = allValues.length > 0 ? Math.max(...allValues) : 100;
        const min = allValues.length > 0 ? Math.min(...allValues) : 0;
        const yDomain: [number, number] = [
          Math.max(0, Math.floor(min * 0.85)),
          Math.ceil(max * 1.2),
        ];

        return {
          exercise: ex,
          color: getColor(ex, idx),
          data: projectionPoints,
          rawPoints: points,
          ghostKg,
          yDomain,
        };
      })
      .filter((c) => c.rawPoints.length > 0);
  }, [exercises, sessions, recordsBySession, benchmarks]);

  return (
    <section className="px-5 flex flex-col gap-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl text-ink-0 tracking-wider leading-none uppercase">
            STRENGTH PROGRESS
          </h2>
          <p className="text-xs font-cond text-ink-3 leading-none">
            나의 1RM 추이 · 우상향 목표
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-pt-2 border border-pt-5">
        {(Object.keys(EXERCISE_GROUPS) as ExerciseGroupKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "tap-haptic flex-1 py-3 rounded-lg font-cond font-bold text-sm tracking-wider leading-none transition-all",
              tab === k ? "bg-volt text-black glow-volt" : "text-ink-2"
            )}
          >
            {EXERCISE_GROUP_LABELS[k]}
          </button>
        ))}
      </div>

      {/* 차트 카드들 */}
      {charts.length === 0 ? (
        <div className="pt-card text-center py-8">
          <p className="text-ink-3 font-cond text-sm">
            완료된 운동 기록이 없습니다
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {charts.map((c) => (
            <SingleExerciseChart key={c.exercise} chart={c} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── 단일 종목 차트 ──────────────── */
function SingleExerciseChart({
  chart,
}: {
  chart: {
    exercise: string;
    color: string;
    data: { date: string; orm: number; projection?: number }[];
    rawPoints: { date: string; orm: number; isPR: boolean }[];
    ghostKg: number | null;
    yDomain: [number, number];
  };
}) {
  const lastPoint = chart.rawPoints[chart.rawPoints.length - 1];
  const firstPoint = chart.rawPoints[0];
  const totalGrowth = lastPoint.orm - firstPoint.orm;
  const prCount = chart.rawPoints.filter((p) => p.isPR).length;

  // PR 노드 좌표
  const prPoints = chart.data
    .map((d, i) => ({ ...d, idx: i }))
    .filter((d, i) => {
      // chart.data에는 projection 포함, 실제 데이터만 매칭
      const pt = chart.rawPoints[i];
      return pt && pt.isPR;
    });

  // gradient ID 충돌 방지
  const gradId = `grad-${chart.exercise.replace(/\s/g, "")}`;

  return (
    <div className="pt-card flex flex-col gap-5" style={{ padding: 24 }}>
      {/* 헤더 */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full"
            style={{
              background: chart.color,
              boxShadow: `0 0 10px ${chart.color}80`,
            }}
          />
          <p
            className="font-cond font-bold tracking-wider leading-none uppercase"
            style={{ color: chart.color, fontSize: 14 }}
          >
            {chart.exercise}
          </p>
        </div>
        <p
          className="font-display tabular-nums leading-none"
          style={{
            color: chart.color,
            fontSize: 28,
            textShadow: `0 0 14px ${chart.color}60`,
          }}
        >
          {lastPoint.orm}
          <span className="text-ink-3 text-xs ml-1.5">kg</span>
        </p>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart
          data={chart.data}
          margin={{ top: 14, right: 8, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={chart.color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
          <XAxis
            dataKey="date"
            tick={{
              fill: "#666",
              fontSize: 10,
              fontFamily: "Barlow Condensed",
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={chart.yDomain}
            tick={{
              fill: "#666",
              fontSize: 10,
              fontFamily: "Barlow Condensed",
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(10,10,10,0.95)",
              border: `1px solid ${chart.color}80`,
              borderRadius: 10,
              fontFamily: "Barlow Condensed",
              fontSize: 12,
              padding: "8px 12px",
              backdropFilter: "blur(8px)",
            }}
            labelStyle={{ color: "#999", marginBottom: 4 }}
            cursor={{ stroke: chart.color, strokeOpacity: 0.3 }}
          />

          {/* Ghost Runner — Advanced 평행선 */}
          {chart.ghostKg !== null && (
            <ReferenceLine
              y={chart.ghostKg}
              stroke="#94a3b8"
              strokeDasharray="6 6"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: `상위 10% · ${chart.ghostKg}kg`,
                fill: "#94a3b8",
                fontSize: 9,
                fontFamily: "Barlow Condensed",
                position: "insideTopRight",
              }}
            />
          )}

          {/* Area: 실제 기록 */}
          <Area
            type="monotone"
            dataKey="orm"
            stroke={chart.color}
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            dot={(props) => {
              const { cx, cy, index } = props;
              const pt = chart.rawPoints[index ?? 0];
              if (!pt || !cx || !cy) return <></>;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={pt.isPR ? 5 : 3.5}
                  fill={chart.color}
                  stroke="#000"
                  strokeWidth={pt.isPR ? 2 : 1}
                  style={{
                    filter: pt.isPR
                      ? `drop-shadow(0 0 8px ${chart.color})`
                      : undefined,
                  }}
                />
              );
            }}
            activeDot={{ r: 6, stroke: "#000", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={true}
            animationDuration={800}
          />

          {/* 미래 예측: 점선 */}
          <Line
            type="monotone"
            dataKey="projection"
            stroke={chart.color}
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeOpacity={0.6}
            dot={false}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 메트릭 + 배지 */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-pt-5 flex-wrap">
        <div className="flex items-center gap-4">
          {totalGrowth > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">
                성장
              </span>
              <span
                className="font-display tabular-nums leading-none"
                style={{ color: chart.color, fontSize: 16 }}
              >
                +{totalGrowth}
                <span className="text-[10px] ml-0.5">kg</span>
              </span>
            </div>
          )}
          {prCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Trophy size={11} style={{ color: chart.color }} />
              <span
                className="font-cond font-bold leading-none"
                style={{ color: chart.color, fontSize: 11 }}
              >
                NEW PR · {prCount}
              </span>
            </div>
          )}
        </div>

        {chart.ghostKg !== null && lastPoint.orm < chart.ghostKg && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(148,163,184,0.10)",
              border: "1px solid rgba(148,163,184,0.25)",
            }}
          >
            <Target size={10} style={{ color: "#94a3b8" }} />
            <span className="text-[10px] font-cond text-ink-2 leading-none">
              상위 10%까지{" "}
              <span className="text-volt font-bold">
                {chart.ghostKg - lastPoint.orm}kg
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
