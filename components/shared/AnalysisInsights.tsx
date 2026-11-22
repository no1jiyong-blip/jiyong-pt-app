"use client";

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
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

type AttendanceType = "pt" | "personal" | "both";
type AttendanceRecord = { type: AttendanceType; title: string };

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

export function AnalysisInsights({ sessions, recordsBySession, personalLogs }: Props) {
  const now = new Date();

  const [historyTab, setHistoryTab] = useState<"monthly" | "weekly">("monthly");
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(
    now.toISOString().slice(0, 10)
  );

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
  const thisWeekEnd = new Date(
    thisWeekStart.getFullYear(),
    thisWeekStart.getMonth(),
    thisWeekStart.getDate() + 6,
    thisWeekStart.getHours(),
    thisWeekStart.getMinutes(),
    thisWeekStart.getSeconds(),
    thisWeekStart.getMilliseconds()
  );
  const thisWeekRangeLabel = `${thisWeekStart.getMonth() + 1}/${thisWeekStart.getDate()} ~ ${thisWeekEnd.getMonth() + 1}/${thisWeekEnd.getDate()}`;

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
    const thisMonthPT = completedSessions.filter(
      (s) => s.date >= thisMonthStart && s.date <= today
    ).length;

    const thisMonthPersonal = personalLogs.filter(
      (l) => l.log_date >= thisMonthStart && l.log_date <= today
    ).length;

    const prevMonthPT = completedSessions.filter(
      (s) => s.date >= prevMonthStart && s.date <= prevMonthEnd
    ).length;

    const thisWeekPT = completedSessions.filter(
      (s) => s.date >= thisWeekStartStr && s.date <= today
    ).length;

    const prevWeekPT = completedSessions.filter(
      (s) => s.date >= prevWeekStartStr && s.date <= prevWeekEndStr
    ).length;

    const thisWeekPersonal = personalLogs.filter(
      (l) => l.log_date >= thisWeekStartStr && l.log_date <= today
    ).length;

    const prevWeekPersonal = personalLogs.filter(
      (l) => l.log_date >= prevWeekStartStr && l.log_date <= prevWeekEndStr
    ).length;

    const monthlyChangePct =
      prevMonthPT > 0
        ? Math.round(((thisMonthPT - prevMonthPT) / prevMonthPT) * 100)
        : thisMonthPT > 0
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
      prevWeekPersonal,
      monthlyChangePct,
    };
  }, [completedSessions, personalLogs, thisMonthStart, today, prevMonthStart, prevMonthEnd, thisWeekStartStr, prevWeekStartStr, prevWeekEndStr]);

  const weekDiff =
    attendance.thisWeekPT + attendance.thisWeekPersonal - (attendance.prevWeekPT + attendance.prevWeekPersonal);

  /* ─── 날짜별 출석 기록 (캘린더/주간 스트립 공용) ─── */
  const attendanceRecords = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};

    completedSessions.forEach((s) => {
      const names = Array.from(new Set((recordsBySession[s.id] ?? []).map((r) => r.exercise_name)));
      const title = names.length > 0 ? `PT 수업 · ${names.slice(0, 3).join(" · ")}` : "PT 수업";
      map[s.date] = { type: "pt", title };
    });

    personalLogs.forEach((l) => {
      const personalTitle = `개인 운동 · ${l.workout_memo ?? l.exercise_name}`;
      const existing = map[l.log_date];
      if (!existing) {
        map[l.log_date] = { type: "personal", title: personalTitle };
      } else if (existing.type === "pt") {
        map[l.log_date] = { type: "both", title: `${existing.title} + ${personalTitle}` };
      } else {
        map[l.log_date] = { ...existing, title: `${existing.title} · ${personalTitle}` };
      }
    });

    return map;
  }, [completedSessions, recordsBySession, personalLogs]);

  /* ─── 이번 주 월~일 출석 스트립 ─── */
  const thisWeekDays = useMemo(() => {
    const labels = ["월", "화", "수", "목", "금", "토", "일"];
    return labels.map((label, i) => {
      const d = new Date(
        thisWeekStart.getFullYear(),
        thisWeekStart.getMonth(),
        thisWeekStart.getDate() + i
      );
      const dateStr = d.toISOString().slice(0, 10);
      return { day: label, status: attendanceRecords[dateStr]?.type ?? null };
    });
  }, [thisWeekStart, attendanceRecords]);

  /* ─── 캘린더 월 이동 ─── */
  const handlePrevCalendarMonth = () => {
    if (calendarMonth === 1) {
      setCalendarYear(calendarYear - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
    setCalendarSelectedDate(null);
  };

  const handleNextCalendarMonth = () => {
    if (calendarMonth === 12) {
      setCalendarYear(calendarYear + 1);
      setCalendarMonth(1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
    setCalendarSelectedDate(null);
  };

  const calendarMonthTotal = useMemo(() => {
    const prefix = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}`;
    return Object.entries(attendanceRecords).reduce((acc, [date, record]) => {
      if (!date.startsWith(prefix)) return acc;
      return acc + (record.type === "both" ? 2 : 1);
    }, 0);
  }, [attendanceRecords, calendarYear, calendarMonth]);

  /* ─── ATTENDANCE LOG: 최근 6개월 / 최근 6주 ─── */
  const monthlyTrend = useMemo(() => {
    const months: { label: string; pt: number; personal: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const { start, end, label } = monthRangeFromNow(now, -i);
      const rangeEnd = i === 0 ? today : end;
      const pt = completedSessions.filter((s) => s.date >= start && s.date <= rangeEnd).length;
      const personal = personalLogs.filter((l) => l.log_date >= start && l.log_date <= rangeEnd).length;
      months.push({ label, pt, personal, total: pt + personal });
    }
    return months;
  }, [completedSessions, personalLogs, now, today]);

  const weeklyTrend = useMemo(() => {
    const weeks: { label: string; pt: number; personal: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
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
      const label = i === 0 ? "이번 주" : `${ws.getMonth() + 1}/${ws.getDate()}주`;
      weeks.push({ label, pt, personal, total: pt + personal });
    }
    return weeks;
  }, [completedSessions, personalLogs, thisWeekStart]);

  const activeHistory = historyTab === "monthly" ? monthlyTrend : weeklyTrend;
  const historyMax = Math.max(...activeHistory.map((d) => d.total), 1);

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
      {/* ─── 1. 이번 주 활동 리포트 ─── */}
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
              이번 주 운동 횟수와 월별 출석 기록을 확인하세요
            </p>
          </div>
          <CalendarDays size={16} className="text-volt mb-1" />
        </div>

        <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] font-cond font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(211,255,82,0.12)", color: "var(--volt)" }}
            >
              이번 주 ({thisWeekRangeLabel})
            </span>
            <span className="text-[11px] font-cond text-ink-3">
              수업 <strong style={{ color: "var(--volt)" }}>{attendance.thisWeekPT}회</strong> · 개인{" "}
              <strong style={{ color: "#5BA8FF" }}>{attendance.thisWeekPersonal}회</strong>
            </span>
          </div>

          <div>
            <p className="text-[11px] font-cond text-ink-3 mb-1">이번 주 총 운동 참여</p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display leading-none" style={{ fontSize: 40, color: "var(--ink-0)" }}>
                {attendance.thisWeekPT + attendance.thisWeekPersonal}
              </span>
              <span className="text-base font-cond font-bold text-ink-3">회</span>
            </div>
          </div>

          {/* 월~일 요일별 참여 인디케이터 */}
          <div className="grid grid-cols-7 gap-1.5">
            {thisWeekDays.map((item) => {
              const isPt = item.status === "pt" || item.status === "both";
              const isPersonal = item.status === "personal" || item.status === "both";
              return (
                <div
                  key={item.day}
                  className="flex flex-col items-center justify-center py-2 rounded-xl"
                  style={
                    isPt
                      ? { background: "rgba(211,255,82,0.10)", border: "1px solid rgba(211,255,82,0.4)", color: "var(--volt)" }
                      : isPersonal
                      ? { background: "rgba(91,168,255,0.10)", border: "1px solid rgba(91,168,255,0.4)", color: "#5BA8FF" }
                      : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--ink-4)" }
                  }
                >
                  <span className="text-xs font-cond font-bold leading-none">{item.day}</span>
                  <div className="flex items-center justify-center gap-1 mt-1.5" style={{ height: 6 }}>
                    {isPt && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }} />
                    )}
                    {isPersonal && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8FF", boxShadow: "0 0 6px #5BA8FF" }} />
                    )}
                    {!isPt && !isPersonal && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 저번 주 비교 */}
        <div className="pt-card flex items-center justify-between gap-3" style={{ padding: 16 }}>
          <span className="text-[11px] font-cond text-ink-3">저번 주 운동 참여</span>
          <div className="flex items-center gap-2">
            <span className="font-cond font-bold leading-none text-ink-0" style={{ fontSize: 13 }}>
              총 {attendance.prevWeekPT + attendance.prevWeekPersonal}회
            </span>
            <span className="text-[11px] font-cond text-ink-4">
              (수업 {attendance.prevWeekPT} · 개인 {attendance.prevWeekPersonal})
            </span>
            {weekDiff !== 0 && (
              <span
                className="flex items-center gap-0.5 text-[11px] font-cond font-bold"
                style={{ color: weekDiff > 0 ? "var(--volt)" : "var(--danger)" }}
              >
                {weekDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {weekDiff > 0 ? "+" : ""}
                {weekDiff}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ─── 2. 출석 캘린더 ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3
            className="font-display text-ink-0 leading-none tracking-wide uppercase"
            style={{ fontSize: 20 }}
          >
            ATTENDANCE
          </h3>
          <div className="flex items-center gap-3 text-[10px] font-cond text-ink-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }} />
              수업
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8FF", boxShadow: "0 0 6px #5BA8FF" }} />
              개인
            </span>
          </div>
        </div>

        <AttendanceCalendar
          year={calendarYear}
          month={calendarMonth}
          selectedDate={calendarSelectedDate}
          onSelectDate={setCalendarSelectedDate}
          onPrevMonth={handlePrevCalendarMonth}
          onNextMonth={handleNextCalendarMonth}
          records={attendanceRecords}
          monthTotal={calendarMonthTotal}
        />
      </section>

      {/* ─── 3. 월별/주별 출석 기록 ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3
            className="font-display text-ink-0 leading-none tracking-wide uppercase"
            style={{ fontSize: 20 }}
          >
            ATTENDANCE LOG
          </h3>
          <div
            className="flex gap-1 p-1 rounded-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {(["monthly", "weekly"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setHistoryTab(g)}
                className="tap-haptic px-2.5 py-1 rounded-lg text-[10px] font-cond font-bold transition-all"
                style={
                  historyTab === g
                    ? { background: "rgba(255,255,255,0.10)", color: "var(--ink-0)" }
                    : { color: "var(--ink-3)" }
                }
              >
                {g === "monthly" ? "월별" : "주별"}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
          {/* 막대 그래프 */}
          <div
            className="grid grid-cols-6 gap-2 items-end"
            style={{ height: 150, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingTop: 20, paddingBottom: 12 }}
          >
            {activeHistory.map((item, idx) => {
              const heightPct = Math.round((item.total / historyMax) * 100);
              const isLast = idx === activeHistory.length - 1;
              return (
                <div key={item.label} className="flex flex-col items-center h-full justify-end">
                  <span
                    className="text-[11px] font-cond font-bold mb-1.5 leading-none"
                    style={{ color: isLast ? "var(--volt)" : "var(--ink-2)" }}
                  >
                    {item.total}회
                  </span>
                  <div
                    className="w-full flex items-end overflow-hidden"
                    style={{ maxWidth: 26, height: 96, background: "rgba(255,255,255,0.05)", borderRadius: "8px 8px 0 0" }}
                  >
                    <div
                      style={{
                        height: `${heightPct}%`,
                        width: "100%",
                        background: isLast ? "var(--volt)" : "rgba(255,255,255,0.18)",
                        borderRadius: "8px 8px 0 0",
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-cond mt-2 leading-none"
                    style={{ color: isLast ? "var(--ink-0)" : "var(--ink-4)", fontWeight: isLast ? 700 : 500 }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 상세 데이터 리스트 */}
          <div className="flex flex-col gap-2.5">
            {[...activeHistory].reverse().map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="text-sm font-cond font-bold text-ink-0 leading-none">
                    {historyTab === "monthly" ? `${item.label} 누적 출석` : `${item.label} 출석`}
                  </p>
                  <p className="text-[11px] font-cond text-ink-3 mt-1 leading-none">
                    수업 참여 <span style={{ color: "var(--volt)", fontWeight: 700 }}>{item.pt}회</span> · 개인 운동{" "}
                    <span style={{ color: "#5BA8FF", fontWeight: 700 }}>{item.personal}회</span>
                  </p>
                </div>
                <span className="font-display tabular-nums leading-none" style={{ fontSize: 18, color: "var(--ink-0)" }}>
                  {item.total}회
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. 4주 성장 캐릭터 진단 ─── */}
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

function AttendanceCalendar({
  year,
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  records,
  monthTotal,
}: {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  records: Record<string, AttendanceRecord>;
  monthTotal: number;
}) {
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: ({ day: number; dateStr: string; record: AttendanceRecord | null } | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, dateStr, record: records[dateStr] ?? null });
    }
    return cells;
  }, [year, month, records]);

  const selectedRecord = selectedDate ? records[selectedDate] ?? null : null;

  return (
    <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
      {/* 상단 연월 & 누적 뱃지 & 월 이동 버튼 */}
      <div
        className="flex items-center justify-between pb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-display tabular-nums leading-none" style={{ fontSize: 20, color: "var(--ink-0)" }}>
            {year}.{String(month).padStart(2, "0")}
          </span>
          <span
            className="text-[10px] font-cond font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(211,255,82,0.10)", color: "var(--volt)", border: "1px solid rgba(211,255,82,0.25)" }}
          >
            총 {monthTotal}회 출석
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="이전 달"
            className="tap-haptic w-8 h-8 rounded-full flex items-center justify-center"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--ink-3)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="다음 달"
            className="tap-haptic w-8 h-8 rounded-full flex items-center justify-center"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--ink-3)" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d} className="text-[11px] font-cond text-ink-3">
            {d}
          </span>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-2 text-center">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-11" />;
          }

          const { day, dateStr, record } = cell;
          const isSelected = selectedDate === dateStr;

          return (
            <div key={dateStr} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => onSelectDate(dateStr)}
                className="tap-haptic w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-all"
                style={
                  isSelected
                    ? { background: "rgba(211,255,82,0.10)", border: "1px solid var(--volt)", color: "var(--volt)" }
                    : { border: "1px solid transparent", color: "var(--ink-1)" }
                }
              >
                <span className="text-sm font-cond font-bold leading-none">{day}</span>
                <div className="flex items-center justify-center gap-1 mt-1" style={{ height: 6 }}>
                  {record?.type === "pt" && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }} />
                  )}
                  {record?.type === "personal" && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8FF", boxShadow: "0 0 6px #5BA8FF" }} />
                  )}
                  {record?.type === "both" && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }} />
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8FF", boxShadow: "0 0 6px #5BA8FF" }} />
                    </>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* 선택 날짜 상세 기록 바 */}
      <div className="pt-3.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {selectedDate ? (
          selectedRecord ? (
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-cond font-bold px-2 py-0.5 rounded shrink-0"
                style={
                  selectedRecord.type === "personal"
                    ? { background: "rgba(91,168,255,0.15)", color: "#5BA8FF" }
                    : { background: "rgba(211,255,82,0.15)", color: "var(--volt)" }
                }
              >
                {selectedDate.slice(5).replace("-", "/")}
              </span>
              <span className="text-xs font-cond text-ink-1 truncate">{selectedRecord.title}</span>
            </div>
          ) : (
            <p className="text-xs font-cond text-ink-4">
              {selectedDate.slice(5).replace("-", "/")} · 등록된 운동 기록이 없습니다
            </p>
          )
        ) : (
          <p className="text-xs font-cond text-ink-4">날짜를 선택하면 상세 운동 내역을 확인할 수 있습니다</p>
        )}
      </div>
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
