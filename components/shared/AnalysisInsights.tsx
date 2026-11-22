"use client";

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  CalendarDays,
  UserCheck,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Session, ExerciseRecord, Member, PersonalLog } from "@/lib/types";
import { calcOneRM } from "@/lib/types";

/* ─── N개월 전 월의 [시작일, 종료일, 라벨] ──────────── */
function monthRangeFromNow(now: Date, offset: number) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end, label: `${m + 1}월` };
}

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
}

/* ─── 캐릭터 정의 ──────────── */
const CHARACTERS = {
  explosive: {
    emoji: "🔥",
    label: "폭발적 성장형",
    color: "#ff8c00",
    bg: "rgba(255,140,0,0.10)",
    border: "rgba(255,140,0,0.30)",
  },
  steady: {
    emoji: "💪",
    label: "꾸준한 성실형",
    color: "#D3FF52",
    bg: "rgba(211,255,82,0.10)",
    border: "rgba(211,255,82,0.30)",
  },
  recovering: {
    emoji: "🌱",
    label: "재도약 준비형",
    color: "#5BA8FF",
    bg: "rgba(91,168,255,0.10)",
    border: "rgba(91,168,255,0.30)",
  },
  declining: {
    emoji: "⚠️",
    label: "활동 감소형",
    color: "#ff5577",
    bg: "rgba(255,85,119,0.10)",
    border: "rgba(255,85,119,0.30)",
  },
  starter: {
    emoji: "🌱",
    label: "기초 다지기형",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.10)",
    border: "rgba(148,163,184,0.30)",
  },
} as const;

type CharKey = keyof typeof CHARACTERS;

export function AnalysisInsights({
  member,
  sessions,
  recordsBySession,
  personalLogs,
}: Props) {
  const now = new Date();

  const [period, setPeriod] = useState<"week" | "month1" | "month2" | "all">("week");
  const [trendGranularity, setTrendGranularity] = useState<"weekly" | "monthly">("weekly");

  /* ─── 날짜 경계 계산 ─── */
  const today = now.toISOString().slice(0, 10);

  // 이번 달 1일 ~ 오늘
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // 저번 달
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = prevMonthDate.toISOString().slice(0, 10);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  // 이번 주 (월요일 기준) — Date 객체를 직접 mutate하지 않고, 시/분/초까지
  // 그대로 유지한 채 날짜만 옮겨서 새로 생성 (UTC 변환 시 자정 경계 밀림 방지)
  const dow = now.getDay();
  const thisWeekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (dow === 0 ? 6 : dow - 1),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10);

  // 저번 주
  const prevWeekStart = new Date(
    thisWeekStart.getFullYear(),
    thisWeekStart.getMonth(),
    thisWeekStart.getDate() - 7,
    thisWeekStart.getHours(),
    thisWeekStart.getMinutes(),
    thisWeekStart.getSeconds(),
    thisWeekStart.getMilliseconds()
  );
  const prevWeekEnd = new Date(
    thisWeekStart.getFullYear(),
    thisWeekStart.getMonth(),
    thisWeekStart.getDate() - 1,
    thisWeekStart.getHours(),
    thisWeekStart.getMinutes(),
    thisWeekStart.getSeconds(),
    thisWeekStart.getMilliseconds()
  );
  const prevWeekStartStr = prevWeekStart.toISOString().slice(0, 10);
  const prevWeekEndStr = prevWeekEnd.toISOString().slice(0, 10);

  /* ─── 완료된 수업 (여러 useMemo에서 공유) ─── */
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed"),
    [sessions]
  );

  /* ─── 출석 계산 ─── */
  const attendance = useMemo(() => {
    // 이번 달 수업 참여
    const thisMonthPT = completedSessions.filter(
      (s) => s.date >= thisMonthStart && s.date <= today
    ).length;

    // 이번 달 개인 운동
    const thisMonthPersonal = personalLogs.filter(
      (l) => l.log_date >= thisMonthStart && l.log_date <= today
    ).length;

    // 저번 달 수업
    const prevMonthPT = completedSessions.filter(
      (s) => s.date >= prevMonthStart && s.date <= prevMonthEnd
    ).length;

    // 이번 주 수업
    const thisWeekPT = completedSessions.filter(
      (s) => s.date >= thisWeekStartStr && s.date <= today
    ).length;

    // 저번 주 수업
    const prevWeekPT = completedSessions.filter(
      (s) => s.date >= prevWeekStartStr && s.date <= prevWeekEndStr
    ).length;

    // 이번 주 개인
    const thisWeekPersonal = personalLogs.filter(
      (l) => l.log_date >= thisWeekStartStr && l.log_date <= today
    ).length;

    // 월 대비 변화율
    const monthlyChangePct =
      prevMonthPT > 0
        ? Math.round(((thisMonthPT - prevMonthPT) / prevMonthPT) * 100)
        : thisMonthPT > 0
        ? 100
        : 0;

    // 주 대비 변화율
    const weeklyChangePct =
      prevWeekPT > 0
        ? Math.round(((thisWeekPT - prevWeekPT) / prevWeekPT) * 100)
        : thisWeekPT > 0
        ? 100
        : 0;

    return {
      thisMonthPT,
      thisMonthPersonal,
      thisMonthTotal: thisMonthPT + thisMonthPersonal,
      prevMonthPT,
      thisWeekPT,
      prevWeekPT,
      thisWeekPersonal,
      monthlyChangePct,
      weeklyChangePct,
    };
  }, [completedSessions, personalLogs, thisMonthStart, today, prevMonthStart, prevMonthEnd, thisWeekStartStr, prevWeekStartStr, prevWeekEndStr]);

  /* ─── ACTIVITY REPORT: 4개 기간(이번 주 / 이번 달 / 저번 달 / 전체 누적) ─── */
  const activityPeriods = useMemo(() => {
    const countRange = (start: string, end: string) => {
      const pt = completedSessions.filter((s) => s.date >= start && s.date <= end).length;
      const personal = personalLogs.filter((l) => l.log_date >= start && l.log_date <= end).length;
      return { pt, personal, total: pt + personal };
    };
    const pct = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

    const thisMonth = monthRangeFromNow(now, 0);
    const prevMonth = monthRangeFromNow(now, -1);
    const prevPrevMonth = monthRangeFromNow(now, -2);

    const weekCur = countRange(thisWeekStartStr, today);
    const weekPrev = countRange(prevWeekStartStr, prevWeekEndStr);

    const m1Cur = countRange(thisMonth.start, today);
    const m1Prev = countRange(prevMonth.start, prevMonth.end);

    const m2Cur = countRange(prevMonth.start, prevMonth.end);
    const m2Prev = countRange(prevPrevMonth.start, prevPrevMonth.end);

    const allDates = [
      ...completedSessions.map((s) => s.date),
      ...personalLogs.map((l) => l.log_date),
    ].sort();
    const allStart = allDates[0] ?? member.start_date ?? today;
    const allCur = countRange(allStart, today);

    return {
      week: {
        label: "이번 주",
        ...weekCur,
        changePct: pct(weekCur.total, weekPrev.total),
        compareLabel: "저번 주 대비",
        hasPrev: true,
      },
      month1: {
        label: thisMonth.label,
        ...m1Cur,
        changePct: pct(m1Cur.total, m1Prev.total),
        compareLabel: `${prevMonth.label} 대비`,
        hasPrev: true,
      },
      month2: {
        label: prevMonth.label,
        ...m2Cur,
        changePct: pct(m2Cur.total, m2Prev.total),
        compareLabel: `${prevPrevMonth.label} 대비`,
        hasPrev: true,
      },
      all: {
        label: "전체 누적",
        ...allCur,
        changePct: null as number | null,
        compareLabel: `${allStart.slice(0, 4)}.${allStart.slice(5, 7)}부터 누적`,
        hasPrev: false,
      },
    };
  }, [completedSessions, personalLogs, now, today, thisWeekStartStr, prevWeekStartStr, prevWeekEndStr, member.start_date]);

  const selectedPeriod = activityPeriods[period];

  /* ─── ATTENDANCE TREND: 최근 8주 / 최근 6개월 추이 ─── */
  const weeklyTrend = useMemo(() => {
    const weeks: { label: string; total: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(
        thisWeekStart.getFullYear(),
        thisWeekStart.getMonth(),
        thisWeekStart.getDate() - i * 7
      );
      const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
      const wsStr = ws.toISOString().slice(0, 10);
      const weStr = we.toISOString().slice(0, 10);
      const pt = completedSessions.filter((s) => s.date >= wsStr && s.date <= weStr).length;
      const personal = personalLogs.filter((l) => l.log_date >= wsStr && l.log_date <= weStr).length;
      weeks.push({ label: `${ws.getMonth() + 1}/${ws.getDate()}`, total: pt + personal });
    }
    return weeks;
  }, [completedSessions, personalLogs, thisWeekStart]);

  const monthlyTrend = useMemo(() => {
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const { start, end, label } = monthRangeFromNow(now, -i);
      const rangeEnd = i === 0 ? today : end;
      const pt = completedSessions.filter((s) => s.date >= start && s.date <= rangeEnd).length;
      const personal = personalLogs.filter((l) => l.log_date >= start && l.log_date <= rangeEnd).length;
      months.push({ label, total: pt + personal });
    }
    return months;
  }, [completedSessions, personalLogs, now, today]);

  const trendStats = useMemo(() => {
    const avg = (arr: { total: number }[]) =>
      arr.length > 0 ? Math.round((arr.reduce((s, x) => s + x.total, 0) / arr.length) * 10) / 10 : 0;
    const activeSeries = trendGranularity === "weekly" ? weeklyTrend : monthlyTrend;
    const first = activeSeries[0]?.total ?? 0;
    const last = activeSeries[activeSeries.length - 1]?.total ?? 0;
    const changePct = first > 0 ? Math.round(((last - first) / first) * 100) : last > 0 ? 100 : 0;
    return {
      weeklyAvg: avg(weeklyTrend),
      monthlyAvg: avg(monthlyTrend),
      changePct,
    };
  }, [weeklyTrend, monthlyTrend, trendGranularity]);

  /* ─── 4주 근력 성장률 ─── */
  const strengthGrowth = useMemo(() => {
    const completed = [...completedSessions].sort((a, b) => a.date.localeCompare(b.date));

    const nowForGrowth = new Date();
    const fourWeeksAgo = new Date(
      nowForGrowth.getFullYear(),
      nowForGrowth.getMonth(),
      nowForGrowth.getDate() - 28,
      nowForGrowth.getHours(),
      nowForGrowth.getMinutes(),
      nowForGrowth.getSeconds(),
      nowForGrowth.getMilliseconds()
    );
    const fwa = fourWeeksAgo.toISOString().slice(0, 10);

    const byEx = new Map<string, { date: string; orm: number }[]>();
    completed.forEach((s) => {
      (recordsBySession[s.id] ?? []).forEach((r) => {
        const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
        if (orm <= 0) return;
        if (!byEx.has(r.exercise_name)) byEx.set(r.exercise_name, []);
        byEx.get(r.exercise_name)!.push({ date: s.date, orm });
      });
    });

    let totalGrowth = 0;
    let count = 0;
    let bestEx = "";
    let bestGrowth = 0;

    byEx.forEach((pts, name) => {
      if (pts.length < 2) return;
      const recent = pts[pts.length - 1].orm;
      const past = pts.find((p) => p.date >= fwa)?.orm ?? pts[0].orm;
      if (past <= 0) return;
      const pct = ((recent - past) / past) * 100;
      totalGrowth += pct;
      count++;
      if (Math.abs(pct) > Math.abs(bestGrowth)) {
        bestGrowth = Math.round(pct * 10) / 10;
        bestEx = name;
      }
    });

    return {
      avgPct: count > 0 ? Math.round((totalGrowth / count) * 10) / 10 : 0,
      bestEx,
      bestPct: bestGrowth,
      hasData: completed.length > 0,
    };
  }, [completedSessions, recordsBySession]);

  /* ─── 캐릭터 결정 + 서사 ─── */
  const { charKey, narrative } = useMemo((): {
    charKey: CharKey;
    narrative: string;
  } => {
    const { monthlyChangePct, thisMonthPT } = attendance;
    const { avgPct, bestEx, bestPct, hasData } = strengthGrowth;

    if (!hasData || thisMonthPT === 0) {
      return {
        charKey: "starter",
        narrative:
          "이제 막 시작하신 단계입니다. 처음 8주는 정확한 자세를 익히는 시간이에요. 무게보다 폼이 먼저입니다. 꾸준히 오시는 것 자체가 이미 최고의 성과입니다.",
      };
    }

    if (monthlyChangePct >= 15 && avgPct >= 8) {
      return {
        charKey: "explosive",
        narrative: `지난달보다 출석이 ${monthlyChangePct}% 더 늘었고, 덕분에 전체 근력이 평균 ${avgPct}% 강해졌습니다! 특히 ${bestEx}에서 +${bestPct}%의 폭발적 성장이 나왔어요. 이 페이스를 유지하면서도 회복(수면·영양)에 반드시 신경 써주세요.`,
      };
    }

    if (avgPct >= 5 && monthlyChangePct >= 0) {
      return {
        charKey: "steady",
        narrative: `꾸준히 ${avgPct}%씩 근력이 발전하고 있습니다. ${bestEx}에서 +${bestPct}%의 성장이 눈에 띄었어요. 이런 안정적인 패턴이 장기적으로 가장 단단한 몸을 만듭니다. 지금 이 루틴이 정답입니다.`,
      };
    }

    if (monthlyChangePct < -15) {
      return {
        charKey: "declining",
        narrative: `저번 달보다 출석이 ${Math.abs(monthlyChangePct)}% 줄었습니다. 근육은 자극이 없으면 2주 이내에 퇴화가 시작돼요. 지금 바로 주 2회 이상으로 빈도를 올리는 것이 최우선입니다. 작게 시작해도 괜찮아요.`,
      };
    }

    if (monthlyChangePct >= 0 && avgPct < 3) {
      return {
        charKey: "recovering",
        narrative: `출석은 유지되고 있지만 근력 성장 속도가 다소 느린 상태예요. 지금이 운동 강도를 한 단계 올릴 타이밍입니다. 현재 사용하는 무게에서 2.5kg만 더 추가하거나, 마지막 세트를 실패 지점까지 밀어붙여 보세요.`,
      };
    }

    return {
      charKey: "steady",
      narrative: `현재 데이터 기준으로 안정적인 성장 궤도에 있습니다. ${bestEx ? `${bestEx}에서 두드러진 향상이 보이며, ` : ""}꾸준한 출석이 가장 큰 자산입니다.`,
    };
  }, [attendance, strengthGrowth]);

  const char = CHARACTERS[charKey];

  return (
    <div className="flex flex-col gap-7">
      {/* ─── 1. 이번 달 출석 지표 ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <h3
              className="font-display text-ink-0 leading-none tracking-wide uppercase"
              style={{ fontSize: 20 }}
            >
              ACTIVITY REPORT
            </h3>
            <p className="text-[11px] font-cond text-ink-3 leading-none">
              기간을 선택해 활동량을 확인하세요
            </p>
          </div>
          <CalendarDays size={16} className="text-volt mb-1" />
        </div>

        {/* 기간 스위처 */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {(["week", "month1", "month2", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className="tap-haptic flex-1 px-2 py-1.5 rounded-lg text-[11px] font-cond font-bold transition-all"
              style={
                period === p
                  ? { background: "rgba(255,255,255,0.10)", color: "var(--ink-0)" }
                  : { color: "var(--ink-3)" }
              }
            >
              {activityPeriods[p].label}
            </button>
          ))}
        </div>

        {/* 3단 출석 카드 */}
        <div className="grid grid-cols-3 gap-2.5">
          <AttendanceMini
            icon={UserCheck}
            label="수업 참여"
            value={selectedPeriod.pt}
            unit="회"
            color="#D3FF52"
          />
          <AttendanceMini
            icon={Dumbbell}
            label="개인 운동"
            value={selectedPeriod.personal}
            unit="회"
            color="#5BA8FF"
          />
          <AttendanceMini
            icon={Flame}
            label="총합"
            value={selectedPeriod.total}
            unit="회"
            color="#ff8c00"
            highlight
          />
        </div>

        {/* 직전 기간 대비 */}
        <div className="pt-card flex items-center justify-between gap-3" style={{ padding: 18 }}>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[10px] font-cond font-bold text-ink-2 tracking-wide-2 uppercase leading-none">
              {selectedPeriod.compareLabel}
            </p>
            {!selectedPeriod.hasPrev && (
              <p className="text-[10px] font-cond text-ink-4 leading-none">
                첫 기록부터 지금까지의 누적 활동량입니다
              </p>
            )}
          </div>
          {selectedPeriod.changePct !== null && (
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedPeriod.changePct >= 0 ? (
                <TrendingUp size={14} className="text-volt" />
              ) : (
                <TrendingDown size={14} className="text-danger" />
              )}
              <span
                className="font-display tabular-nums leading-none"
                style={{
                  fontSize: 20,
                  color: selectedPeriod.changePct >= 0 ? "var(--volt)" : "var(--danger)",
                }}
              >
                {selectedPeriod.changePct >= 0 ? "+" : ""}
                {selectedPeriod.changePct}%
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ─── 1-2. 출석 추이 (주간/월간) ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3
            className="font-display text-ink-0 leading-none tracking-wide uppercase"
            style={{ fontSize: 20 }}
          >
            ATTENDANCE TREND
          </h3>
          <div
            className="flex gap-1 p-1 rounded-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {(["weekly", "monthly"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setTrendGranularity(g)}
                className="tap-haptic px-2.5 py-1 rounded-lg text-[10px] font-cond font-bold transition-all"
                style={
                  trendGranularity === g
                    ? { background: "rgba(255,255,255,0.10)", color: "var(--ink-0)" }
                    : { color: "var(--ink-3)" }
                }
              >
                {g === "weekly" ? "WEEKLY" : "MONTHLY"}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={trendGranularity === "weekly" ? weeklyTrend : monthlyTrend}
              margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="attendanceTrendGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D3FF52" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D3FF52" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(8,8,8,0.95)",
                  border: "1px solid #333",
                  borderRadius: 10,
                  fontFamily: "Barlow Condensed",
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                y={trendGranularity === "weekly" ? 2 : 8}
                stroke="#5BA8FF"
                strokeDasharray="4 4"
                label={{
                  value: "ACSM 권장",
                  position: "insideTopRight",
                  fill: "#5BA8FF",
                  fontSize: 10,
                  fontFamily: "Barlow Condensed",
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#D3FF52"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#attendanceTrendGlow)"
                dot={{ r: 3.5, fill: "#D3FF52", stroke: "#080808", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-2">
            <MiniMetric
              label="주 평균 출석"
              value={`${trendStats.weeklyAvg}회`}
              sub="최근 8주"
              positive
            />
            <MiniMetric
              label="월 평균 출석"
              value={`${trendStats.monthlyAvg}회`}
              sub="최근 6개월"
              positive
            />
            <MiniMetric
              label="초기 대비 변화"
              value={`${trendStats.changePct >= 0 ? "+" : ""}${trendStats.changePct}%`}
              sub={trendGranularity === "weekly" ? "8주 전 대비" : "6개월 전 대비"}
              positive={trendStats.changePct >= 0}
            />
          </div>
        </div>
      </section>

      {/* ─── 2. 4주 성장 캐릭터 진단 ─── */}
      <section className="flex flex-col gap-4">
        <h3
          className="font-display text-ink-0 leading-none tracking-wide uppercase"
          style={{ fontSize: 20 }}
        >
          CHARACTER DIAGNOSIS
        </h3>

        <div
          className="pt-card flex flex-col gap-5"
          style={{
            padding: 24,
            background: `linear-gradient(160deg, ${char.bg} 0%, rgba(20,20,20,0.85) 70%)`,
            borderColor: char.border,
            boxShadow: `0 0 20px ${char.bg}`,
          }}
        >
          <div className="flex items-center gap-4">
            <span
              style={{
                fontSize: 52,
                filter: `drop-shadow(0 0 12px ${char.color}60)`,
                lineHeight: 1,
              }}
            >
              {char.emoji}
            </span>
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={12} style={{ color: char.color }} />
                <p
                  className="text-[10px] font-cond font-bold tracking-wide-2 uppercase leading-none"
                  style={{ color: char.color }}
                >
                  4주 성장 캐릭터
                </p>
              </div>
              <p
                className="font-display uppercase leading-none"
                style={{
                  color: char.color,
                  fontSize: 24,
                  textShadow: `0 0 12px ${char.color}50`,
                  letterSpacing: "-0.02em",
                }}
              >
                {char.label}
              </p>
            </div>
          </div>

          {/* 수치 요약 */}
          <div className="grid grid-cols-3 gap-2">
            <MiniMetric
              label="이번 달 출석"
              value={`${attendance.thisMonthTotal}회`}
              sub={
                attendance.monthlyChangePct !== 0
                  ? `${attendance.monthlyChangePct > 0 ? "+" : ""}${attendance.monthlyChangePct}%`
                  : "—"
              }
              positive={attendance.monthlyChangePct >= 0}
            />
            <MiniMetric
              label="4주 근력 성장"
              value={`${strengthGrowth.avgPct >= 0 ? "+" : ""}${strengthGrowth.avgPct}%`}
              sub={strengthGrowth.bestEx || "—"}
              positive={strengthGrowth.avgPct >= 0}
            />
            <MiniMetric
              label="주 평균"
              value={`${Math.round((attendance.thisMonthPT / 4) * 10) / 10}회`}
              sub="PT 기준"
              positive
            />
          </div>

          {/* 서사 */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-sm text-ink-1 leading-relaxed">{narrative}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── 서브 컴포넌트들 ──────────────────────────────── */

function AttendanceMini({
  icon: Icon,
  label,
  value,
  unit,
  color,
  highlight = false,
}: {
  icon: typeof UserCheck;
  label: string;
  value: number;
  unit: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="pt-card flex flex-col gap-2.5 items-center text-center"
      style={{
        padding: 16,
        borderColor: highlight ? `${color}40` : undefined,
        background: highlight
          ? `linear-gradient(160deg, ${color}12 0%, rgba(20,20,20,0.85) 100%)`
          : undefined,
      }}
    >
      <Icon size={14} style={{ color }} />
      <p className="text-[9px] font-cond text-ink-3 tracking-wider leading-none uppercase">
        {label}
      </p>
      <p
        className="font-display tabular-nums leading-none"
        style={{ fontSize: 28, color, letterSpacing: "-0.02em" }}
      >
        {value}
        <span className="text-ink-3 text-xs ml-0.5">{unit}</span>
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 items-center text-center rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--pt-5)",
      }}
    >
      <p className="text-[9px] font-cond text-ink-3 tracking-wider leading-none uppercase">
        {label}
      </p>
      <p
        className="font-display tabular-nums leading-none"
        style={{
          fontSize: 17,
          color: positive ? "var(--volt)" : "var(--danger)",
        }}
      >
        {value}
      </p>
      <p className="text-[9px] font-cond text-ink-4 leading-none truncate w-full text-center">
        {sub}
      </p>
    </div>
  );
}

