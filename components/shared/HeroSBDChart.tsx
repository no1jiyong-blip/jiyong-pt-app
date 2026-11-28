"use client";

import { useMemo } from "react";
import {
  ComposedChart,
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

const VOLT = "#D3FF52";

interface Props {
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  benchmarks: BenchmarkData[];
  gender?: "male" | "female" | null;
  /** 지정하면 이 종목 차트 하나만 렌더링 (헤더/하단 메트릭 없이) — GrowthTab 통합 히어로 카드용 */
  only?: string;
}

const MALE_SBD = ["스쿼트", "데드리프트", "벤치프레스"] as const;
const FEMALE_SBD = ["스쿼트", "데드리프트", "숄더프레스"] as const;

export function HeroSBDChart({ sessions, recordsBySession, benchmarks, gender, only }: Props) {
  const SBD = gender === "female" ? FEMALE_SBD : MALE_SBD;
  const charts = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    return SBD.map((name) => {
      const points: {
        date: string;
        orm: number;
        isPR: boolean;
        actualWeight: number;
        reps: number;
        isActual: boolean;
      }[] = [];
      let prevMax = 0;

      completed.forEach((s) => {
        const recs = (recordsBySession[s.id] ?? []).filter(
          (r) => r.exercise_name === name
        );
        if (recs.length === 0) return;

        // 해당 세션에서 1RM이 가장 높게 나온 세트 하나를 찾음 (실제 중량×횟수 근거로 툴팁에 사용)
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

        const label = `${s.date.slice(5, 7)}/${s.date.slice(8, 10)}`;
        const isPR = bestORM > prevMax;
        if (isPR) prevMax = bestORM;
        const rec = bestRec as ExerciseRecord;
        points.push({
          date: label,
          orm: bestORM,
          isPR,
          actualWeight: rec.weight ?? 0,
          reps: rec.reps ?? 0,
          // 1회(reps=1)로 직접 들어올린 기록이면 '실측', 그 외엔 Brzycki 공식 '추정'
          isActual: (rec.reps ?? 0) === 1,
        });
      });

      // Ghost (advanced_kg)
      const bench = benchmarks.find((b) => b.exercise_name === name);
      const ghostKg = bench?.advanced_kg ?? null;

      // 미래 예측 (선형회귀)
      const allData: {
        date: string;
        orm: number | null;
        proj: number | null;
        actualWeight: number | null;
        reps: number | null;
        isActual: boolean;
      }[] = points.map((p) => ({
        date: p.date,
        orm: p.orm,
        proj: null,
        actualWeight: p.actualWeight,
        reps: p.reps,
        isActual: p.isActual,
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
          allData.push({
            date: `+${i * 2}주`,
            orm: null,
            proj: projected,
            actualWeight: null,
            reps: null,
            isActual: false,
          });
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
        name,
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
          <h3 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
            3대 운동 추이
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

interface TooltipRow {
  orm: number | null;
  proj: number | null;
  actualWeight: number | null;
  reps: number | null;
  isActual: boolean;
}

/** 회원 친화적 커스텀 툴팁 — 실측 1RM(1회 직접 수행) vs 공식 추정 vs 미래 예측을 구분해서 쉬운 말로 설명 */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: unknown; payload?: TooltipRow }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry =
    payload.find((p) => p.dataKey === "orm" && p.value != null) ??
    payload.find((p) => p.dataKey === "proj" && p.value != null);
  if (!entry || entry.value == null || typeof entry.value !== "number" || !entry.payload) return null;
  const value = entry.value;
  const row = entry.payload;
  const isProjected = entry.dataKey === "proj";
  const isActual = !isProjected && row.isActual;

  const badgeColor = isActual || isProjected ? VOLT : "var(--ink-3)";
  const badgeLabel = isProjected ? "예측" : isActual ? "실측 1RM" : "공식 추정";

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: "rgba(10,10,10,0.95)",
        border: "1px solid var(--pt-6)",
        backdropFilter: "blur(12px)",
        minWidth: 170,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 pb-2 mb-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <span className="text-xs font-cond font-bold text-ink-2">
          {isProjected ? `성장 예측 (${label})` : `${label} 측정 세션`}
        </span>
        <span
          className="text-[9px] font-cond font-bold px-1.5 py-0.5 rounded-full tracking-wider shrink-0"
          style={{ background: `${badgeColor}1A`, color: badgeColor, border: `1px solid ${badgeColor}50` }}
        >
          {badgeLabel}
        </span>
      </div>

      {/* 실제 수행 내용 (몇 kg으로 몇 회 했는지) */}
      {!isProjected && row.actualWeight !== null && row.reps !== null && (
        <div
          className="mb-2 px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-ink-3 font-cond font-semibold">실제 수행</span>
          <span className="font-mono-num font-bold text-ink-0">
            {row.actualWeight}kg × {row.reps}회
          </span>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-cond font-semibold text-ink-3">
          {isActual ? "실제 최대 근력" : isProjected ? "예상 도달 근력" : "추정 최대 근력"}
        </span>
        <span className="font-mono-num font-extrabold text-sm" style={{ color: badgeColor }}>
          {value}
          <span className="text-[10px] text-ink-0 ml-0.5">KG</span>
        </span>
      </div>
      <p className="text-[9px] text-ink-4 leading-tight pt-1 text-right">
        {isActual
          ? "※ 1회 성공 기준 실측 기록"
          : isProjected
          ? "※ 현재 성장 추세 유지 시 예상치"
          : "※ 해당 세션 최고 세트 기준 Brzycki 공식 추정"}
      </p>
    </div>
  );
}

interface ChartItem {
  name: string;
  data: {
    date: string;
    orm: number | null;
    proj: number | null;
    actualWeight: number | null;
    reps: number | null;
    isActual: boolean;
  }[];
  rawPoints: {
    date: string;
    orm: number;
    isPR: boolean;
    actualWeight: number;
    reps: number;
    isActual: boolean;
  }[];
  ghostKg: number | null;
  yDomain: [number, number];
  totalGrowth: number;
  prCount: number;
  streak: number;
  current: number;
}

function SBDCard({ chart, bare = false }: { chart: ChartItem; bare?: boolean }) {
  const body = (
    <>
      {!bare && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-cond font-bold leading-none" style={{ color: "var(--ink-0)", fontSize: 14 }}>
            {chart.name}
          </p>
          {chart.current > 0 && (
            <p
              className="font-display tabular-nums leading-none"
              style={{ fontSize: 32, color: VOLT, textShadow: "0 0 16px rgba(211,255,82,0.5)" }}
            >
              {chart.current}
              <span className="text-ink-3 text-xs ml-1.5">kg</span>
            </p>
          )}
        </div>
      )}

      {/* 차트 — 면 채우기 없이 라인 중심, 현재 지점만 얇은 링으로 강조 */}
      <ResponsiveContainer width="100%" height={bare ? 220 : 180}>
        <ComposedChart data={chart.data} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#555", fontSize: 10, fontFamily: "Pretendard" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={chart.yDomain}
            tick={{ fill: "#555", fontSize: 10, fontFamily: "Pretendard" }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            width={32}
            tickFormatter={(v: number) => `${Math.round(v)}`}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} />}
            cursor={{ stroke: VOLT, strokeOpacity: 0.25 }}
          />
          {chart.ghostKg && (
            <ReferenceLine
              y={chart.ghostKg}
              stroke="#64748b"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `목표 · ${chart.ghostKg}kg`,
                fill: "#64748b",
                fontSize: 9,
                fontFamily: "Pretendard",
                position: "insideTopRight",
              }}
            />
          )}
          {/* 실제 1RM 추이 — 라인만, 면 채우기 없음 */}
          <Line
            type="monotone"
            dataKey="orm"
            stroke={VOLT}
            strokeWidth={2.5}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              // 현재(최신) 지점 하나만 카드 배경에 어울리는 얇은 링으로 표시 — 나머지는 호버 시에만 노출
              const isLatest = index === chart.rawPoints.length - 1;
              if (!isLatest || cx === undefined || cy === undefined) return <></>;
              return (
                <circle key="latest-dot" cx={cx} cy={cy} r={4} fill={VOLT} stroke="#141414" strokeWidth={2} />
              );
            }}
            activeDot={{ r: 5.5, fill: VOLT, stroke: "#141414", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive
            animationDuration={800}
          />
          {/* 예측 점선 */}
          <Line
            type="monotone"
            dataKey="proj"
            stroke={VOLT}
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeOpacity={0.6}
            dot={false}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 메트릭 — 관리자 전체 대시보드에서만 표시 (member 통합 카드는 OneRMReportCard가 이미 커버) */}
      {!bare && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-pt-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            {chart.streak >= 2 ? (
              <>
                <Award size={13} style={{ color: VOLT }} />
                <span className="font-cond font-bold text-xs leading-none text-ink-0">
                  <span style={{ color: VOLT }}>{chart.streak}회 연속</span> 개인 최고 기록(PR) 경신
                </span>
              </>
            ) : chart.prCount > 0 ? (
              <>
                <Trophy size={11} style={{ color: VOLT }} />
                <span className="font-cond font-bold leading-none" style={{ color: VOLT, fontSize: 11 }}>
                  PR × {chart.prCount}
                </span>
              </>
            ) : null}
          </div>
          {chart.ghostKg && chart.current > 0 && chart.current < chart.ghostKg && (
            <span
              className="px-3 py-1.5 rounded-full text-[10px] font-cond font-semibold leading-none shrink-0"
              style={{
                background: "rgba(211,255,82,0.1)",
                border: "1px solid rgba(211,255,82,0.25)",
                color: VOLT,
              }}
            >
              목표까지 {chart.ghostKg - chart.current}kg 남음
            </span>
          )}
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
        background: "linear-gradient(160deg, rgba(211,255,82,0.06) 0%, rgba(20,20,20,0.85) 60%)",
        borderColor: "rgba(211,255,82,0.18)",
      }}
    >
      {body}
    </div>
  );
}
