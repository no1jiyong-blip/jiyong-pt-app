"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Trophy, Award } from "lucide-react";
import type { Session, ExerciseRecord, BenchmarkData } from "@/lib/types";
import { calcOneRM } from "@/lib/types";

interface Props {
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  benchmarks: BenchmarkData[];
  gender?: "male" | "female" | null;
  /** 지정하면 이 종목 차트 하나만 렌더링 (헤더 없이) — GrowthTab 통합 히어로 카드용 */
  only?: string;
}

const MALE_SBD = [
  { name: "스쿼트", color: "#D3FF52", glow: "rgba(211,255,82,0.5)" },
  { name: "데드리프트", color: "#5BA8FF", glow: "rgba(91,168,255,0.5)" },
  { name: "벤치프레스", color: "#E8E8E8", glow: "rgba(232,232,232,0.4)" },
] as const;
const FEMALE_SBD = [
  { name: "스쿼트", color: "#D3FF52", glow: "rgba(211,255,82,0.5)" },
  { name: "데드리프트", color: "#5BA8FF", glow: "rgba(91,168,255,0.5)" },
  { name: "숄더프레스", color: "#ff8c00", glow: "rgba(255,140,0,0.5)" },
] as const;

export function HeroSBDChart({ sessions, recordsBySession, benchmarks, gender, only }: Props) {
  const SBD = gender === "female" ? FEMALE_SBD : MALE_SBD;
  const charts = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    return SBD.map((ex) => {
      const points: { date: string; orm: number; isPR: boolean }[] = [];
      let prevMax = 0;

      completed.forEach((s) => {
        const recs = (recordsBySession[s.id] ?? []).filter(
          (r) => r.exercise_name === ex.name
        );
        if (recs.length === 0) return;
        const maxORM = Math.max(...recs.map((r) => calcOneRM(r.weight ?? 0, r.reps ?? 0)));
        if (maxORM <= 0) return;
        const label = `${s.date.slice(5, 7)}/${s.date.slice(8, 10)}`;
        const isPR = maxORM > prevMax;
        if (isPR) prevMax = maxORM;
        points.push({ date: label, orm: maxORM, isPR });
      });

      // Ghost (advanced_kg)
      const bench = benchmarks.find((b) => b.exercise_name === ex.name);
      const ghostKg = bench?.advanced_kg ?? null;

      // 미래 예측 (선형회귀)
      const allData: { date: string; orm: number | null; proj: number | null }[] = points.map((p) => ({
        date: p.date,
        orm: p.orm,
        proj: null,
      }));

      if (points.length >= 3) {
        const n = points.length;
        const xs = points.map((_, i) => i);
        const ys = points.map((p) => p.orm);
        const xm = xs.reduce((a, b) => a + b, 0) / n;
        const ym = ys.reduce((a, b) => a + b, 0) / n;
        const slope =
          xs.reduce((acc, x, i) => acc + (x - xm) * (ys[i] - ym), 0) /
          (xs.reduce((acc, x) => acc + (x - xm) ** 2, 0) || 1);

        const lastOrm = points[points.length - 1].orm;
        // 마지막 실제 포인트에 proj 연결
        allData[allData.length - 1].proj = lastOrm;
        for (let i = 1; i <= 3; i++) {
          const projected = Math.max(lastOrm, Math.round(lastOrm + slope * i));
          allData.push({ date: `+${i * 2}주`, orm: null, proj: projected });
        }
      }

      const maxVal = Math.max(
        ...points.map((p) => p.orm),
        ...(ghostKg ? [ghostKg] : [])
      );
      const minVal = Math.min(...points.map((p) => p.orm));
      const yDomain: [number, number] = [
        Math.max(0, Math.floor(minVal * 0.85)),
        Math.ceil(maxVal * 1.2),
      ];

      const totalGrowth = points.length >= 2
        ? points[points.length - 1].orm - points[0].orm
        : 0;
      const prCount = points.filter((p) => p.isPR).length;

      // 최근 연속 PR 갱신 횟수 (마지막 세션부터 거슬러 올라가며 PR이 끊길 때까지)
      let streak = 0;
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].isPR) streak++;
        else break;
      }

      return {
        ...ex,
        data: allData,
        rawPoints: points,
        ghostKg,
        yDomain,
        totalGrowth,
        prCount,
        streak,
        current: points[points.length - 1]?.orm ?? 0,
      };
    });
  }, [sessions, recordsBySession, benchmarks, SBD]);

  const visible = only ? charts.filter((c) => c.name === only) : charts;

  if (only) {
    const c = visible[0];
    if (!c || c.rawPoints.length === 0) {
      return (
        <div className="pt-card text-center py-8">
          <p className="text-ink-3 font-cond text-sm">완료된 운동 기록이 없습니다</p>
        </div>
      );
    }
    return <SBDCard chart={c} bare />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl text-ink-0 tracking-wide leading-none uppercase">
            HERO CHART — SBD
          </h3>
          <p className="text-[11px] font-cond text-ink-3 leading-none">
            스쿼트 · 데드리프트 · 벤치프레스 1RM 추이
          </p>
        </div>
      </div>

      {charts.every((c) => c.rawPoints.length === 0) ? (
        <div className="pt-card text-center py-8">
          <p className="text-ink-3 font-cond text-sm">완료된 운동 기록이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {charts.map((c) => c.rawPoints.length > 0 && (
            <SBDCard key={c.name} chart={c} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ChartItem {
  name: string;
  color: string;
  glow: string;
  data: { date: string; orm: number | null; proj: number | null }[];
  rawPoints: { date: string; orm: number; isPR: boolean }[];
  ghostKg: number | null;
  yDomain: [number, number];
  totalGrowth: number;
  prCount: number;
  streak: number;
  current: number;
}

function SBDCard({ chart, bare = false }: { chart: ChartItem; bare?: boolean }) {
  const gradId = `sbd-${chart.name}`;

  const body = (
    <>
      {!bare && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: chart.color, boxShadow: `0 0 10px ${chart.glow}` }}
            />
            <p
              className="font-cond font-bold uppercase tracking-wider leading-none"
              style={{ color: chart.color, fontSize: 13 }}
            >
              {chart.name}
            </p>
          </div>
          {chart.current > 0 && (
            <p
              className="font-display tabular-nums leading-none"
              style={{ fontSize: 32, color: chart.color, textShadow: `0 0 16px ${chart.glow}` }}
            >
              {chart.current}
              <span className="text-ink-3 text-xs ml-1.5">kg</span>
            </p>
          )}
        </div>
      )}

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={bare ? 220 : 180}>
        <ComposedChart data={chart.data} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={chart.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={chart.yDomain}
            tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(8,8,8,0.96)",
              border: `1px solid ${chart.color}60`,
              borderRadius: 10,
              fontFamily: "Barlow Condensed",
              fontSize: 12,
              backdropFilter: "blur(8px)",
            }}
            labelStyle={{ color: "#888", marginBottom: 4 }}
          />
          {chart.ghostKg && (
            <ReferenceLine
              y={chart.ghostKg}
              stroke="#64748b"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Goal · ${chart.ghostKg}kg`,
                fill: "#64748b",
                fontSize: 9,
                fontFamily: "Barlow Condensed",
                position: "insideTopRight",
              }}
            />
          )}
          {/* 실제 Area */}
          <Area
            type="monotone"
            dataKey="orm"
            stroke={chart.color}
            strokeWidth={3}
            fill={`url(#${gradId})`}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              // 최신 기록(PR) 지점 하나만 펄스 링으로 강조 — 과거 점은 라인/영역으로 충분히 드러남
              const isLatest = index === chart.rawPoints.length - 1;
              if (!isLatest || cx === undefined || cy === undefined) return <></>;
              return (
                <g key="latest-dot">
                  <circle cx={cx} cy={cy} r={10} fill={chart.color} fillOpacity={0.25} />
                  <circle
                    cx={cx} cy={cy} r={4.5}
                    fill={chart.color}
                    stroke="#000"
                    strokeWidth={2}
                    style={{ filter: `drop-shadow(0 0 8px ${chart.color})` }}
                  />
                </g>
              );
            }}
            activeDot={{ r: 7, stroke: "#000", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive
            animationDuration={800}
          />
          {/* 예측 점선 */}
          <Line
            type="monotone"
            dataKey="proj"
            stroke={chart.color}
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeOpacity={0.55}
            dot={false}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 메트릭 */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-pt-5 flex-wrap">
        <div className="flex gap-4">
          {chart.totalGrowth > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-cond text-ink-3 uppercase tracking-wider leading-none">성장</span>
              <span className="font-display leading-none tabular-nums"
                style={{ color: chart.color, fontSize: 15 }}>
                +{chart.totalGrowth}kg
              </span>
            </div>
          )}
          {chart.prCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Trophy size={11} style={{ color: chart.color }} />
              <span className="font-cond font-bold leading-none" style={{ color: chart.color, fontSize: 11 }}>
                PR × {chart.prCount}
              </span>
            </div>
          )}
        </div>
        {chart.ghostKg && chart.current > 0 && chart.current < chart.ghostKg && (
          <span
            className="px-3 py-1.5 rounded-full text-[10px] font-cond leading-none"
            style={{
              background: `${chart.color}1A`,
              border: `1px solid ${chart.color}40`,
              color: chart.color,
            }}
          >
            목표까지 {chart.ghostKg - chart.current}kg
          </span>
        )}
      </div>
      {chart.streak >= 2 && (
        <div className="flex items-center gap-1.5">
          <Award size={11} style={{ color: chart.color }} />
          <span className="font-cond font-bold text-[11px] leading-none" style={{ color: chart.color }}>
            {chart.streak}회 연속 PR 갱신 중
          </span>
        </div>
      )}
    </>
  );

  if (bare) return <div className="flex flex-col gap-4">{body}</div>;

  return (
    <div
      className="pt-card flex flex-col gap-4"
      style={{
        padding: 22,
        background: `linear-gradient(160deg, ${chart.color}12 0%, rgba(20,20,20,0.85) 60%)`,
        borderColor: `${chart.color}30`,
      }}
    >
      {body}
    </div>
  );
}
