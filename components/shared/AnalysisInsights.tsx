"use client";

import { useMemo } from "react";
import {
  Award,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Flame,
  CalendarDays,
  UserCheck,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import type { Session, ExerciseRecord, Member, PersonalLog } from "@/lib/types";
import { calcOneRM, getAge } from "@/lib/types";

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
  const age = getAge(member.birth_date);
  const now = new Date();

  /* ─── 날짜 경계 계산 ─── */
  const today = now.toISOString().slice(0, 10);

  // 이번 달 1일 ~ 오늘
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // 저번 달
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = prevMonthDate.toISOString().slice(0, 10);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  // 이번 주 (월요일 기준)
  const dow = now.getDay();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10);

  // 저번 주
  const prevWeekStart = new Date(thisWeekStart);
  prevWeekStart.setDate(thisWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(thisWeekStart);
  prevWeekEnd.setDate(thisWeekStart.getDate() - 1);
  const prevWeekStartStr = prevWeekStart.toISOString().slice(0, 10);
  const prevWeekEndStr = prevWeekEnd.toISOString().slice(0, 10);

  /* ─── 출석 계산 ─── */
  const attendance = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.status === "completed");

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
  }, [sessions, personalLogs, thisMonthStart, today, prevMonthStart, prevMonthEnd, thisWeekStartStr, prevWeekStartStr, prevWeekEndStr]);

  /* ─── 4주 근력 성장률 ─── */
  const strengthGrowth = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
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
  }, [sessions, recordsBySession]);

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

  /* ─── ACSM 기반 인사이트 카드 ─── */
  const insights = useMemo(() => {
    const cards: {
      type: "pro" | "warn" | "tip";
      title: string;
      text: string;
    }[] = [];

    // 1. 출석 기반
    if (attendance.weeklyChangePct >= 20) {
      cards.push({
        type: "pro",
        title: "이번 주 출석 우수",
        text: `저번 주 대비 ${attendance.weeklyChangePct}% 더 운동했습니다. ACSM 권장 주 150분 활동량을 충족하고 있어요. 이 페이스가 지속되면 심폐 기능과 근력이 동시에 향상됩니다.`,
      });
    } else if (attendance.weeklyChangePct < -20) {
      cards.push({
        type: "warn",
        title: "이번 주 활동량 감소",
        text: `저번 주보다 ${Math.abs(attendance.weeklyChangePct)}% 줄었습니다. ACSM 가이드라인은 최소 주 2회 근력 운동을 권장해요. 10분이라도 짧게 가시는 게 쉬는 것보다 훨씬 낫습니다.`,
      });
    }

    // 2. 근력 성장 기반
    if (strengthGrowth.avgPct >= 10) {
      cards.push({
        type: "pro",
        title: "근신경계 적응 활성화",
        text: `4주간 평균 ${strengthGrowth.avgPct}% 성장은 탁월한 수치입니다. 초기 근력 향상의 80%는 실제 근육 증가가 아닌 신경 적응에서 옵니다. 지금 단계가 가장 빠르게 강해지는 골든타임이에요.`,
      });
    } else if (strengthGrowth.avgPct < 0 && strengthGrowth.hasData) {
      cards.push({
        type: "warn",
        title: "근력 수치 감소 감지",
        text: `4주간 근력이 소폭 감소했습니다. 원인은 수면 부족, 영양 불균형, 또는 과훈련일 수 있어요. 이번 주는 볼륨을 20% 줄이고 회복에 집중하는 'Deload Week'를 권장합니다.`,
      });
    }

    // 3. 연령별 조언
    if (age !== null) {
      if (age >= 35) {
        cards.push({
          type: "tip",
          title: `${age}세 맞춤 — 회복 프로토콜`,
          text: `35세 이상은 코르티솔 반감기가 길어져 회복 시간이 20대보다 48시간 더 필요할 수 있어요. 워밍업 10분 + 쿨다운 10분을 반드시 지키고, 주 1회는 가벼운 유산소(심박수 65%, 노래 부르기 힘든 강도)로 능동적 회복일을 가지세요.`,
        });
      } else {
        cards.push({
          type: "tip",
          title: "골든 에이지 — 지금이 최적기",
          text: `20~30대는 근단백질 합성 속도가 가장 빠른 시기예요. 운동 후 30분 내 단백질 섭취(체중 × 0.4g)를 꼭 챙기세요. 유청 단백질 1스쿱 + 바나나 조합이 가장 실용적입니다.`,
        });
      }
    }

    // 4. 식단 가이드
    const proteinTarget = member.gender === "female" ? 1.6 : 1.8;
    cards.push({
      type: "tip",
      title: "단백질 섭취 가이드",
      text: `신지용 트레이너 권장: 체중 × ${proteinTarget}g의 단백질이 근성장에 최적입니다. 닭가슴살 외에 계란(개당 6g), 연어(100g당 20g), 두부(100g당 8g)를 다양하게 드세요. 한 끼에 몰아 먹기보다 3~4끼에 분산 섭취가 핵심입니다.`,
    });

    return cards;
  }, [attendance, strengthGrowth, age, member.gender]);

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
              {now.getMonth() + 1}월 1일 ~ 오늘 기준
            </p>
          </div>
          <CalendarDays size={16} className="text-volt mb-1" />
        </div>

        {/* 3단 출석 카드 */}
        <div className="grid grid-cols-3 gap-2.5">
          <AttendanceMini
            icon={UserCheck}
            label="수업 참여"
            value={attendance.thisMonthPT}
            unit="회"
            color="#D3FF52"
          />
          <AttendanceMini
            icon={Dumbbell}
            label="개인 운동"
            value={attendance.thisMonthPersonal}
            unit="회"
            color="#5BA8FF"
          />
          <AttendanceMini
            icon={Flame}
            label="총합"
            value={attendance.thisMonthTotal}
            unit="회"
            color="#ff8c00"
            highlight
          />
        </div>

        {/* 주간/월간 비교 */}
        <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
          <p
            className="text-[10px] font-cond font-bold text-ink-2 tracking-wide-2 uppercase leading-none"
          >
            활동량 변화 비교
          </p>
          <div className="grid grid-cols-2 gap-3">
            <CompareBar
              label="이번 주 vs 저번 주"
              thisVal={attendance.thisWeekPT + attendance.thisWeekPersonal}
              prevVal={attendance.prevWeekPT}
              changePct={attendance.weeklyChangePct}
            />
            <CompareBar
              label="이번 달 vs 저번 달"
              thisVal={attendance.thisMonthPT}
              prevVal={attendance.prevMonthPT}
              changePct={attendance.monthlyChangePct}
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

      {/* ─── 3. ACSM 기반 인사이트 카드들 ─── */}
      <section className="flex flex-col gap-4">
        <h3
          className="font-display text-ink-0 leading-none tracking-wide uppercase"
          style={{ fontSize: 20 }}
        >
          JIYONG PT INSIGHTS
        </h3>
        <p className="text-[11px] font-cond text-ink-3 leading-none -mt-2">
          ACSM 가이드라인 기반 · 신지용 트레이너 9년 경력 분석
        </p>

        <div className="flex flex-col gap-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} type={ins.type} title={ins.title} text={ins.text} />
          ))}
        </div>

        <p className="text-[10px] font-cond text-ink-4 text-center leading-relaxed italic">
          * ACSM(미국스포츠의학회) 가이드라인 + 트레이너 임상 경험 기반 자동 분석입니다.
          정확한 처방은 직접 상담을 통해 받으세요.
        </p>
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

function CompareBar({
  label,
  thisVal,
  prevVal,
  changePct,
}: {
  label: string;
  thisVal: number;
  prevVal: number;
  changePct: number;
}) {
  const isUp = changePct >= 0;
  const maxVal = Math.max(thisVal, prevVal, 1);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10px] font-cond text-ink-3 leading-none">{label}</p>

      {/* 바 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div
            className="rounded-full"
            style={{
              height: 8,
              width: `${(thisVal / maxVal) * 100}%`,
              minWidth: 4,
              background: "var(--grad-volt-bar)",
              boxShadow: "0 0 8px var(--volt-glow-2)",
            }}
          />
          <span className="text-[10px] font-cond font-bold text-volt leading-none tabular-nums">
            {thisVal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="rounded-full"
            style={{
              height: 8,
              width: `${(prevVal / maxVal) * 100}%`,
              minWidth: prevVal > 0 ? 4 : 0,
              background: "#2a2a2a",
              border: "1px solid var(--pt-5)",
            }}
          />
          <span className="text-[10px] font-cond text-ink-3 leading-none tabular-nums">
            {prevVal}
          </span>
        </div>
      </div>

      {/* 변화율 */}
      <div className="flex items-center gap-1">
        {isUp ? (
          <TrendingUp size={10} className="text-volt" />
        ) : (
          <TrendingDown size={10} className="text-danger" />
        )}
        <span
          className="text-[10px] font-cond font-bold leading-none"
          style={{ color: isUp ? "var(--volt)" : "var(--danger)" }}
        >
          {isUp ? "+" : ""}
          {changePct}%
        </span>
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

function InsightCard({
  type,
  title,
  text,
}: {
  type: "pro" | "warn" | "tip";
  title: string;
  text: string;
}) {
  const cfg = {
    pro: { Icon: Award, color: "#D3FF52", label: "STRENGTH" },
    warn: { Icon: AlertCircle, color: "#ff8080", label: "ATTENTION" },
    tip: { Icon: TrendingUp, color: "#5BA8FF", label: "ADVICE" },
  }[type];

  return (
    <div
      className="pt-card flex items-start gap-4"
      style={{ padding: 20 }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: `${cfg.color}1A`,
          border: `1px solid ${cfg.color}40`,
        }}
      >
        <cfg.Icon size={16} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-cond font-bold tracking-wider leading-none uppercase"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-ink-0 text-xs font-cond font-bold leading-none">
            {title}
          </span>
        </div>
        <p className="text-xs text-ink-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
