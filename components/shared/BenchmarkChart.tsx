"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ALL_EXERCISES,
  EXERCISE_GROUPS,
  type ExerciseGroupKey,
  EXERCISE_GROUP_LABELS,
  type BenchmarkData,
  type Member,
  type Session,
  type ExerciseRecord,
  calcOneRM,
  getAgeGroup,
  getAge,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
}

interface BarRow {
  exercise: string;
  myORM: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

export function BenchmarkChart({ member, sessions, recordsBySession }: Props) {
  const [tab, setTab] = useState<ExerciseGroupKey>("big3");
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [loading, setLoading] = useState(true);

  const ageGroup = getAgeGroup(member.birth_date);
  const age = getAge(member.birth_date);

  /* Load benchmarks for this member's gender + age group */
  useEffect(() => {
    if (!member.gender || !ageGroup) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("benchmark_data")
        .select("*")
        .eq("gender", member.gender!)
        .eq("age_group", ageGroup);
      setBenchmarks((data ?? []) as BenchmarkData[]);
      setLoading(false);
    })();
  }, [member.gender, ageGroup]);

  /* Compute member's max 1RM per exercise from completed sessions */
  const myMaxByExercise = useMemo(() => {
    const map = new Map<string, number>();
    sessions
      .filter((s) => s.status === "completed")
      .forEach((s) => {
        const recs = recordsBySession[s.id] ?? [];
        recs.forEach((r) => {
          const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
          if (orm > 0) {
            const cur = map.get(r.exercise_name) ?? 0;
            if (orm > cur) map.set(r.exercise_name, orm);
          }
        });
      });
    return map;
  }, [sessions, recordsBySession]);

  /* Build bar rows for current tab's exercises */
  const rows: BarRow[] = useMemo(() => {
    const exercises = EXERCISE_GROUPS[tab];
    return exercises.map((ex) => {
      const bench = benchmarks.find((b) => b.exercise_name === ex);
      return {
        exercise: ex,
        myORM: myMaxByExercise.get(ex) ?? 0,
        beginner: bench?.beginner_kg ?? 0,
        intermediate: bench?.intermediate_kg ?? 0,
        advanced: bench?.advanced_kg ?? 0,
        elite: bench?.elite_kg ?? 0,
      };
    });
  }, [tab, benchmarks, myMaxByExercise]);

  /* Missing prerequisites */
  if (!member.gender || !ageGroup) {
    return (
      <section className="px-6 flex flex-col gap-5">
        <h2 className="section-title">
          <span className="section-bar-blue"></span>
          벤치마크 비교
        </h2>
        <div className="pt-card text-center">
          <p className="text-ink-3 font-cond text-sm leading-relaxed">
            성별과 생년월일 정보가 등록되어야
            <br />벤치마크 비교를 확인할 수 있습니다
          </p>
          <p className="text-ink-3 font-cond text-xs mt-3 leading-relaxed">
            트레이너에게 문의해 주세요
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 flex flex-col gap-5">
      {/* Title + meta */}
      <div className="flex flex-col gap-3">
        <h2 className="section-title">
          <span className="section-bar-blue"></span>
          벤치마크 비교
        </h2>
        <p className="text-xs text-ink-3 font-cond leading-relaxed">
          {member.gender === "male" ? "남성" : "여성"} · 만 {age}세 ·{" "}
          {ageGroup === "20s"
            ? "20대"
            : ageGroup === "30s"
            ? "30대"
            : ageGroup === "40s"
            ? "40대"
            : ageGroup === "50s"
            ? "50대"
            : "60대 이상"}{" "}
          평균 대비
        </p>
      </div>

      <div className="pt-card flex flex-col gap-7">
        {/* Tabs */}
        <div className="flex gap-2 p-1.5 rounded-xl bg-pt-2 border border-pt-5">
          {(Object.keys(EXERCISE_GROUPS) as ExerciseGroupKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex-1 py-3 rounded-lg font-cond font-bold text-sm tracking-wider leading-none transition-all",
                tab === k ? "bg-volt text-black glow-volt" : "text-ink-2"
              )}
            >
              {EXERCISE_GROUP_LABELS[k]}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-cond">
          <Legend color="var(--chart-volt)" label="내 기록" highlight />
          <Legend color="var(--chart-1)" label="초급" />
          <Legend color="var(--chart-2)" label="중급" />
          <Legend color="var(--chart-3)" label="상급" />
          <Legend color="var(--chart-4)" label="엘리트" />
        </div>

        {/* Bars */}
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-ink-3 font-cond text-sm anim-pulse">
              데이터 불러오는 중...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {rows.map((row) => (
              <BenchmarkBar key={row.exercise} row={row} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Legend({
  color,
  label,
  highlight,
}: {
  color: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-full"
        style={{
          width: 10,
          height: 10,
          backgroundColor: color,
          boxShadow: highlight ? `0 0 8px ${color}` : undefined,
        }}
      />
      <span
        className={cn(
          "leading-none",
          highlight ? "text-volt font-bold" : "text-ink-2"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function BenchmarkBar({ row }: { row: BarRow }) {
  // Max value to scale all bars (use elite as ceiling, but at least myORM)
  const max = Math.max(row.elite, row.myORM, 1);

  // Tier label for member
  const tier =
    row.myORM === 0
      ? null
      : row.myORM >= row.elite
      ? "엘리트"
      : row.myORM >= row.advanced
      ? "상급"
      : row.myORM >= row.intermediate
      ? "중급"
      : row.myORM >= row.beginner
      ? "초급"
      : "초급 미만";

  const tierColor =
    tier === "엘리트"
      ? "var(--volt)"
      : tier === "상급"
      ? "var(--chart-1)"
      : tier === "중급"
      ? "var(--chart-2)"
      : tier === "초급"
      ? "var(--chart-3)"
      : "var(--ink-3)";

  return (
    <div className="flex flex-col gap-3">
      {/* Exercise name + tier badge */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-cond font-bold text-ink-0 text-sm leading-none">
          {row.exercise}
        </p>
        {tier && (
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-cond font-bold tracking-wider leading-none"
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              color: tierColor,
              border: `1px solid ${tierColor}40`,
            }}
          >
            {tier}
          </span>
        )}
      </div>

      {/* My bar */}
      <BarRow
        label="내 기록"
        kg={row.myORM}
        pct={(row.myORM / max) * 100}
        gradient="var(--grad-volt-bar)"
        labelColor="var(--volt)"
        glow
      />

      {/* Tier bars */}
      <BarRow
        label="초급"
        kg={row.beginner}
        pct={(row.beginner / max) * 100}
        color="var(--chart-1)"
        labelColor="var(--ink-2)"
      />
      <BarRow
        label="중급"
        kg={row.intermediate}
        pct={(row.intermediate / max) * 100}
        color="var(--chart-2)"
        labelColor="var(--ink-2)"
      />
      <BarRow
        label="상급"
        kg={row.advanced}
        pct={(row.advanced / max) * 100}
        color="var(--chart-3)"
        labelColor="var(--ink-2)"
      />
      <BarRow
        label="엘리트"
        kg={row.elite}
        pct={(row.elite / max) * 100}
        color="var(--chart-4)"
        labelColor="var(--ink-2)"
      />
    </div>
  );
}

function BarRow({
  label,
  kg,
  pct,
  color,
  gradient,
  labelColor,
  glow,
}: {
  label: string;
  kg: number;
  pct: number;
  color?: string;
  gradient?: string;
  labelColor: string;
  glow?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Label */}
      <p
        className="font-cond text-xs leading-none w-12 shrink-0"
        style={{ color: labelColor }}
      >
        {label}
      </p>
      {/* Track */}
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{
          height: 10,
          backgroundColor: "var(--pt-2)",
          border: "1px solid var(--pt-5)",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(pct, 0)}%`,
            background: gradient ?? color,
            boxShadow: glow
              ? "0 0 12px var(--volt-glow-2), inset 0 1px 0 rgba(255,255,255,0.2)"
              : undefined,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      {/* Value */}
      <p
        className="font-cond font-bold text-xs leading-none w-14 text-right shrink-0"
        style={{ color: labelColor }}
      >
        {kg > 0 ? `${Math.round(kg)}kg` : "—"}
      </p>
    </div>
  );
}
