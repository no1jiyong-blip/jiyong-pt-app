"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, Check, Circle,
  User, Dumbbell, Target, Activity, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Zap, KeyRound, Pencil, X as XIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type {
  Member, Session, Homework, ExerciseRecord,
  BodyMeasurement, PersonalLog, BenchmarkData, SessionQuality,
} from "@/lib/types";
import { getAgeGroup, getAge } from "@/lib/types";
import {
  formatShortKoreanDate, getTodayISO, getWeekStartISO,
  formatWeekRange, parseHomeworkCategory, HOMEWORK_CATEGORIES,
} from "@/lib/utils";
import type { InBodyValues } from "@/lib/inbody";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { LiveRecordModal } from "@/components/trainer/LiveRecordModal";
import { ResetMemberPasswordModal } from "@/components/trainer/ResetMemberPasswordModal";
import { HeroSBDChart } from "@/components/shared/HeroSBDChart";
import { SupportCarousel } from "@/components/shared/SupportCarousel";
import { MuscleBalanceRadar } from "@/components/shared/MuscleBalanceRadar";
import { OneRMReportCard } from "@/components/shared/OneRMReportCard";
import { AnalysisInsights } from "@/components/shared/AnalysisInsights";
import { InBodyPhotoCapture } from "@/components/shared/InBodyPhotoCapture";

type AdminTab = "home" | "workout" | "mission" | "body";

const TAB_CONFIG: { key: AdminTab; icon: typeof User; label: string }[] = [
  { key: "home",    icon: User,     label: "회원 정보" },
  { key: "workout", icon: Dumbbell, label: "운동 일지" },
  { key: "mission", icon: Target,   label: "미션·소견" },
  { key: "body",    icon: Activity, label: "인바디" },
];

export default function TrainerMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("home");
  const [member, setMember] = useState<Member | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recordsBySession, setRecordsBySession] = useState<Record<string, ExerciseRecord[]>>({});
  const [homework, setHomework] = useState<Homework[]>([]);
  const [bodyHistory, setBodyHistory] = useState<BodyMeasurement[]>([]);
  const [personalLogs, setPersonalLogs] = useState<PersonalLog[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [qualities, setQualities] = useState<SessionQuality[]>([]);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: m }, { data: s }, { data: hw }, { data: bm }, { data: pl }] =
      await Promise.all([
        supabase.from("members").select("*").eq("id", id).maybeSingle(),
        supabase.from("sessions").select("*").eq("member_id", id).order("date", { ascending: false }),
        supabase.from("homework").select("*").eq("member_id", id)
          .order("week_start", { ascending: false }).order("created_at", { ascending: true }),
        supabase.from("body_measurements").select("*").eq("member_id", id).order("measured_at", { ascending: false }),
        supabase.from("personal_logs").select("*").eq("member_id", id).order("log_date", { ascending: false }),
      ]);

    setMember(m as Member | null);
    const sessList = (s ?? []) as Session[];
    setSessions(sessList);
    setHomework((hw ?? []) as Homework[]);
    setBodyHistory((bm ?? []) as BodyMeasurement[]);
    setPersonalLogs((pl ?? []) as PersonalLog[]);

    // 벤치마크 로드 (성별/연령 확인 후)
    const memberData = m as Member | null;
    if (memberData?.gender && memberData?.birth_date) {
      const ageGroup = getAgeGroup(memberData.birth_date);
      if (ageGroup) {
        const { data: bench } = await supabase
          .from("benchmark_data")
          .select("*")
          .eq("gender", memberData.gender)
          .eq("age_group", ageGroup);
        setBenchmarks((bench ?? []) as BenchmarkData[]);
      }
    }

    // session_quality 로드
    if (sessList.length > 0) {
      const completedIds = sessList
        .filter((s) => s.status === "completed")
        .map((s) => s.id);
      if (completedIds.length > 0) {
        const { data: sq } = await supabase
          .from("session_quality")
          .select("*")
          .in("session_id", completedIds);
        setQualities((sq ?? []) as SessionQuality[]);
      }
    }

    if (sessList.length > 0) {
      const ids = sessList.map((x) => x.id);
      const { data: recs } = await supabase.from("exercise_records").select("*").in("session_id", ids);
      const grouped: Record<string, ExerciseRecord[]> = {};
      (recs ?? []).forEach((r: ExerciseRecord) => {
        if (!grouped[r.session_id]) grouped[r.session_id] = [];
        grouped[r.session_id].push(r);
      });
      setRecordsBySession(grouped);
    }
  }, [id]);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user || user.role !== "trainer") { router.replace("/login"); return; }
      loadData().finally(() => setLoading(false));
    });
  }, [router, loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pt-0">
        <p className="font-display text-3xl tracking-wide-3 text-volt anim-pulse">LOADING...</p>
      </div>
    );
  }
  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pt-0 px-6">
        <p className="text-ink-2 font-cond">회원을 찾을 수 없습니다</p>
      </div>
    );
  }

  const remaining = member.total_sessions - member.used_sessions;

  return (
    <main className="min-h-screen bg-pt-0 pb-24">
      <div className="pt-container">
        {/* 상단 헤더 */}
        <header className="px-5 pt-10 pb-2 flex items-center gap-3 safe-pt">
          <button
            onClick={() => router.back()}
            className="tap-haptic w-11 h-11 rounded-full bg-pt-3 flex items-center justify-center text-ink-1 hover:bg-pt-4 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <Avatar name={member.name} size={44} />
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[10px] text-volt font-cond font-bold tracking-wider leading-none uppercase">
                ADMIN · 회원 관리
              </p>
              <h1 className="font-display text-2xl text-ink-0 tracking-wider leading-none truncate">
                {member.name}
              </h1>
            </div>
          </div>
          {/* 잔여 세션 배지 */}
          <div
            className="flex flex-col items-center gap-0.5 shrink-0 px-3 py-2 rounded-xl"
            style={{
              background: remaining <= 3 ? "rgba(255,59,59,0.10)" : "rgba(211,255,82,0.10)",
              border: `1px solid ${remaining <= 3 ? "rgba(255,59,59,0.4)" : "var(--volt-glow-2)"}`,
            }}
          >
            <p
              className="font-display leading-none tabular-nums"
              style={{
                fontSize: 22,
                color: remaining <= 3 ? "var(--danger)" : "var(--volt)",
              }}
            >
              {remaining}
            </p>
            <p className="text-[9px] font-cond text-ink-3 leading-none">잔여</p>
          </div>
        </header>

        {/* 탭 바 */}
        <div className="px-5 mt-6">
          <div
            className="flex p-1.5 gap-1 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
            }}
          >
            {TAB_CONFIG.map(({ key, icon: Icon, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="tap-haptic flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                  style={
                    active
                      ? { background: "rgba(255,255,255,0.09)", boxShadow: "0 1px 4px rgba(0,0,0,0.6)" }
                      : {}
                  }
                >
                  <Icon size={14} style={{ color: active ? "var(--volt)" : "var(--ink-3)" }} />
                  <span className="text-[10px] font-cond font-bold leading-none" style={{ color: active ? "var(--ink-0)" : "var(--ink-3)" }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="mt-6 anim-tab-slide">
          {activeTab === "home" && (
            <HomeTab member={member} sessions={sessions} onUpdate={loadData} />
          )}
          {activeTab === "workout" && (
            <WorkoutTab
              memberId={id}
              member={member}
              sessions={sessions}
              recordsBySession={recordsBySession}
              personalLogs={personalLogs}
              homework={homework}
              benchmarks={benchmarks}
              qualities={qualities}
              onUpdate={loadData}
              onEditSession={(s) => setEditingSession(s)}
            />
          )}
          {activeTab === "mission" && (
            <MissionTab member={member} homework={homework} onUpdate={loadData} />
          )}
          {activeTab === "body" && (
            <BodyTab memberId={id} bodyHistory={bodyHistory} member={member} onUpdate={loadData} />
          )}
        </div>
      </div>

      {editingSession && (
        <LiveRecordModal
          session={editingSession}
          memberName={member.name}
          onClose={() => setEditingSession(null)}
          onSaved={loadData}
        />
      )}
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════
   TAB 1: HOME — 회원 기본 정보 + 세션 관리
   ════════════════════════════════════════════════════════════════ */
function HomeTab({
  member, sessions, onUpdate,
}: {
  member: Member;
  sessions: Session[];
  onUpdate: () => void;
}) {
  const [totalSessions, setTotalSessions] = useState(member.total_sessions);
  const [usedSessions, setUsedSessions] = useState(member.used_sessions);
  const [savingSession, setSavingSession] = useState(false);
  const [deducting, setDeducting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // member prop이 바뀌면 (onUpdate 후) local state 동기화
  useEffect(() => {
    setTotalSessions(member.total_sessions);
    setUsedSessions(member.used_sessions);
  }, [member.total_sessions, member.used_sessions]);

  const saveSessionCounts = async () => {
    setSavingSession(true);
    const { error } = await supabase
      .from("members")
      .update({ total_sessions: totalSessions, used_sessions: usedSessions })
      .eq("id", member.id);
    setSavingSession(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    onUpdate();
  };

  const deductOneSession = async () => {
    if (usedSessions >= totalSessions) {
      alert("잔여 세션이 없습니다."); return;
    }
    setDeducting(true);
    const newUsed = usedSessions + 1;
    const { error } = await supabase
      .from("members")
      .update({ used_sessions: newUsed })
      .eq("id", member.id);
    setDeducting(false);
    if (error) { alert(`차감 실패: ${error.message}`); return; }
    setUsedSessions(newUsed);
    onUpdate();
  };

  const remaining = totalSessions - usedSessions;
  const pct = totalSessions > 0 ? Math.round((usedSessions / totalSessions) * 100) : 0;

  const recentCompleted = sessions
    .filter((s) => s.status === "completed")
    .slice(0, 5);

  return (
    <div className="px-5 flex flex-col gap-7">
      {/* 회원 기본 정보 */}
      <section className="flex flex-col gap-4">
        <SectionTitle bar="volt" en="MEMBER INFO" ko="회원 기본 정보" />
        <div
          className="pt-card flex flex-col gap-4"
          style={{ padding: 22 }}
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["이름", member.name],
              ["성별", member.gender === "male" ? "남성" : member.gender === "female" ? "여성" : "—"],
              ["생년월일", member.birth_date ?? "—"],
              ["연령대", getAge(member.birth_date) ? `만 ${getAge(member.birth_date)}세` : "—"],
              ["목표", member.goal ?? "—"],
              ["시작일", member.start_date ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <p className="text-[9px] font-cond text-ink-3 uppercase tracking-wider leading-none">{label}</p>
                <p className="text-sm font-cond font-bold text-ink-0 leading-tight">{value}</p>
              </div>
            ))}
          </div>
          {member.notes && (
            <div
              className="rounded-xl p-3 border"
              style={{ background: "rgba(255,140,0,0.06)", borderColor: "rgba(255,140,0,0.25)" }}
            >
              <p className="text-[9px] font-cond font-bold text-warn uppercase tracking-wider mb-1.5 leading-none">⚠ 특이사항</p>
              <p className="text-xs text-ink-1 leading-relaxed">{member.notes}</p>
            </div>
          )}

          <button
            onClick={() => setShowResetPassword(true)}
            className="btn-ghost"
            style={{ minHeight: 48 }}
          >
            <KeyRound size={14} />
            비밀번호 재설정
          </button>
        </div>
      </section>

      {showResetPassword && (
        <ResetMemberPasswordModal
          memberId={member.id}
          memberName={member.name}
          onClose={() => setShowResetPassword(false)}
        />
      )}

      {/* 세션 관리 */}
      <section className="flex flex-col gap-4">
        <SectionTitle bar="volt" en="SESSION CONTROL" ko="등록 세션 관리" />

        {/* 원터치 차감 */}
        <button
          onClick={deductOneSession}
          disabled={deducting || remaining <= 0}
          className="tap-haptic rounded-2xl flex items-center justify-center gap-3 font-display tracking-wider"
          style={{
            background: remaining <= 0 ? "var(--pt-4)" : "var(--grad-volt)",
            color: remaining <= 0 ? "var(--ink-3)" : "#000",
            height: 64, fontSize: 17,
            boxShadow: remaining > 0 ? "0 6px 24px var(--volt-glow-2), inset 0 1px 0 rgba(255,255,255,0.3)" : undefined,
            border: remaining <= 0 ? "1px solid var(--pt-5)" : undefined,
          }}
        >
          {deducting ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} strokeWidth={2.5} />}
          PT 수업 완료 (1회 차감)
        </button>

        {remaining <= 3 && remaining > 0 && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-2.5 border"
            style={{ background: "rgba(255,59,59,0.08)", borderColor: "rgba(255,59,59,0.3)" }}
          >
            <AlertTriangle size={14} className="text-danger shrink-0" />
            <p className="text-xs text-danger font-cond leading-relaxed">
              잔여 세션 {remaining}회 — 재등록을 안내해 주세요
            </p>
          </div>
        )}

        {/* 세션 수동 수정 폼 */}
        <div className="pt-card flex flex-col gap-5" style={{ padding: 22 }}>
          <p className="text-[10px] font-cond text-ink-2 uppercase tracking-wider leading-none">수동 조정</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">총 등록 횟수</label>
              <input
                type="number"
                value={totalSessions}
                onChange={(e) => setTotalSessions(Number(e.target.value))}
                className="pt-input text-center font-display"
                style={{ fontSize: 24 }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">사용 횟수</label>
              <input
                type="number"
                value={usedSessions}
                onChange={(e) => setUsedSessions(Number(e.target.value))}
                className="pt-input text-center font-display"
                style={{ fontSize: 24 }}
              />
            </div>
          </div>

          {/* 진행률 바 미리보기 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px] font-cond text-ink-3 leading-none">
              <span>잔여 {remaining}회</span>
              <span>{pct}% 진행</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <button
            onClick={saveSessionCounts}
            disabled={savingSession}
            className="btn-volt"
            style={{ minHeight: 48 }}
          >
            <Save size={14} />
            {savingSession ? "저장 중..." : savedFlash ? "✓ 저장됨!" : "세션 수 저장"}
          </button>
        </div>
      </section>

      {/* 최근 수업 이력 */}
      {recentCompleted.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle bar="blue" en="RECENT SESSIONS" ko="최근 완료 수업" />
          <div className="flex flex-col gap-2.5">
            {recentCompleted.map((s) => (
              <div key={s.id} className="pt-card flex items-center gap-3" style={{ padding: 16 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm leading-none shrink-0"
                  style={{ background: "var(--pt-4)", color: "var(--ink-1)" }}
                >
                  {s.session_number ?? "—"}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="font-cond font-bold text-ink-0 text-sm leading-none truncate">
                    {s.title || "운동 기록"}
                  </p>
                  <p className="text-[10px] font-cond text-ink-3 leading-none">
                    {formatShortKoreanDate(s.date)}
                    {s.time && <span className="ml-2">{s.time}</span>}
                  </p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[9px] font-cond font-bold leading-none shrink-0"
                  style={{ background: "rgba(211,255,82,0.12)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }}
                >
                  완료
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TAB 2: WORKOUT — PT 일지 입력 + 개인 운동 모니터링
   ════════════════════════════════════════════════════════════════ */
function WorkoutTab({
  memberId, member, sessions, recordsBySession, personalLogs, homework,
  benchmarks, qualities, onUpdate, onEditSession,
}: {
  memberId: string;
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
  homework: Homework[];
  benchmarks: BenchmarkData[];
  qualities: SessionQuality[];
  onUpdate: () => void;
  onEditSession: (s: Session) => void;
}) {
  const [showNewSession, setShowNewSession] = useState(false);
  const [newDate, setNewDate] = useState(getTodayISO());
  const [newTime, setNewTime] = useState("10:00");
  const [newTitle, setNewTitle] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [hwItems, setHwItems] = useState(homework);
  useEffect(() => setHwItems(homework), [homework]);

  const [newHomework, setNewHomework] = useState("");
  const [newHwTag, setNewHwTag] = useState<string>(HOMEWORK_CATEGORIES[0]);
  const [savingHw, setSavingHw] = useState(false);
  const [openPastWeek, setOpenPastWeek] = useState<string | null>(null);

  const thisWeekStart = getWeekStartISO();
  const weekItems = hwItems.filter((h) => h.week_start === thisWeekStart);
  const weekCompleted = weekItems.filter((h) => h.is_completed).length;

  /* 이번 주를 제외한 과거 주차별 그룹 (최신순, 조회 전용) */
  const pastHwWeeks = (() => {
    const map = new Map<string, Homework[]>();
    hwItems.forEach((h) => {
      if (h.week_start === thisWeekStart) return;
      if (!map.has(h.week_start)) map.set(h.week_start, []);
      map.get(h.week_start)!.push(h);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ws, list]) => {
        const { rangeLabel, weekLabel } = formatWeekRange(ws);
        return { weekStart: ws, items: list, rangeLabel, weekLabel };
      });
  })();

  /* 출석 완료 + 세션 차감 동시 처리 */
  const completeSession = async (session: Session) => {
    if (session.status === "completed") return;
    setCompletingId(session.id);
    // 1) 세션 status → completed
    await supabase.from("sessions").update({ status: "completed" }).eq("id", session.id);
    // 2) used_sessions +1 (잔여가 있을 때만)
    if (member.used_sessions < member.total_sessions) {
      await supabase
        .from("members")
        .update({ used_sessions: member.used_sessions + 1 })
        .eq("id", member.id);
    }
    setCompletingId(null);
    onUpdate();
  };

  /* 통합 타임라인 */
  type FeedItem =
    | { type: "pt"; session: Session; records: ExerciseRecord[] }
    | { type: "personal"; date: string; logs: PersonalLog[] };

  const feed: FeedItem[] = (() => {
    const items: FeedItem[] = [];
    sessions.filter((s) => s.status === "completed").forEach((s) => {
      items.push({ type: "pt", session: s, records: recordsBySession[s.id] ?? [] });
    });
    const grouped = new Map<string, PersonalLog[]>();
    personalLogs.forEach((l) => {
      if (!grouped.has(l.log_date)) grouped.set(l.log_date, []);
      grouped.get(l.log_date)!.push(l);
    });
    grouped.forEach((logs, date) => items.push({ type: "personal", date, logs }));
    return items.sort((a, b) => {
      const da = a.type === "pt" ? a.session.date : a.date;
      const db = b.type === "pt" ? b.session.date : b.date;
      return db.localeCompare(da);
    });
  })();

  const addSession = async () => {
    setSavingSession(true);
    const { data: existing } = await supabase
      .from("sessions").select("session_number").eq("member_id", memberId)
      .order("session_number", { ascending: false }).limit(1);
    const nextNum = existing && existing.length > 0 ? (existing[0].session_number ?? 0) + 1 : 1;
    await supabase.from("sessions").insert({
      member_id: memberId, date: newDate, time: newTime,
      title: newTitle.trim() || null, status: "scheduled", session_number: nextNum,
    });
    setSavingSession(false);
    setShowNewSession(false);
    setNewTitle("");
    onUpdate();
  };

  const addHomework = async () => {
    if (!newHomework.trim()) return;
    setSavingHw(true);
    const content = `[${newHwTag}] ${newHomework.trim()}`;
    await supabase.from("homework").insert({
      member_id: memberId, week_start: thisWeekStart,
      content, is_completed: false,
    });
    setSavingHw(false);
    setNewHomework("");
    onUpdate();
  };

  const removeHomework = async (hwId: string) => {
    setHwItems((prev) => prev.filter((h) => h.id !== hwId));
    await supabase.from("homework").delete().eq("id", hwId);
    onUpdate();
  };

  /* 회원이 깜빡했을 때 트레이너가 대신 체크/해제 */
  const toggleHomework = async (hw: Homework) => {
    setHwItems((prev) =>
      prev.map((h) => (h.id === hw.id ? { ...h, is_completed: !h.is_completed } : h))
    );
    await supabase.from("homework").update({ is_completed: !hw.is_completed }).eq("id", hw.id);
    onUpdate();
  };

  /* 항목 문구 바로 수정 — 카테고리 태그는 그대로 두고 본문만 교체 */
  const editHomeworkText = (hwId: string, newText: string) => {
    setHwItems((prev) =>
      prev.map((h) => {
        if (h.id !== hwId) return h;
        const { category } = parseHomeworkCategory(h.content);
        return { ...h, content: category ? `[${category}] ${newText}` : newText };
      })
    );
  };

  const commitHomeworkText = async (hwId: string) => {
    const hw = hwItems.find((h) => h.id === hwId);
    if (!hw) return;
    await supabase.from("homework").update({ content: hw.content }).eq("id", hwId);
    onUpdate();
  };

  return (
    <div className="px-5 flex flex-col gap-7">
      {/* PT 수업 추가 */}
      <section className="flex flex-col gap-4">
        <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
          PT 수업 일지 관리
        </h2>

        <button
          onClick={() => setShowNewSession((v) => !v)}
          className="tap-haptic btn-volt"
          style={{ minHeight: 50 }}
        >
          <Plus size={16} strokeWidth={3} />
          {showNewSession ? "취소" : "새 수업 일정 추가"}
        </button>

        {showNewSession && (
          <div className="pt-card flex flex-col gap-4 anim-fade-slide" style={{ padding: 20 }}>
            <p className="text-[10px] font-cond text-volt uppercase tracking-wider leading-none">새 수업 등록</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-cond text-ink-3 uppercase leading-none">날짜</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-cond text-ink-3 uppercase leading-none">시간</label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <Input placeholder="수업 제목 (예: 스쿼트 집중의 날)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <button onClick={addSession} disabled={savingSession} className="btn-volt" style={{ minHeight: 48 }}>
              {savingSession ? "추가 중..." : "수업 추가"}
            </button>
          </div>
        )}

        {/* 예정/완료 세션 목록 */}
        <div className="flex flex-col gap-2.5">
          {sessions.slice(0, 10).map((s) => (
            <div
              key={s.id}
              className="pt-card"
              style={{ padding: 14 }}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-pt-4 flex items-center justify-center font-display text-sm text-ink-2 shrink-0">
                  {s.session_number ?? "?"}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="font-cond font-bold text-ink-0 text-sm leading-none truncate">
                    {s.title || "제목 없음"}
                  </p>
                  <p className="text-[10px] font-cond text-ink-3 leading-none">
                    {formatShortKoreanDate(s.date)}{s.time && ` · ${s.time}`}
                  </p>
                </div>

                {/* 예정 → 출석 완료 버튼 */}
                {s.status === "scheduled" ? (
                  <button
                    onClick={() => completeSession(s)}
                    disabled={completingId === s.id}
                    className="tap-haptic flex items-center gap-1.5 px-3 py-2 rounded-xl font-cond font-bold text-[11px] leading-none shrink-0"
                    style={{
                      background: "var(--grad-volt)", color: "#000",
                      boxShadow: "0 2px 10px var(--volt-glow-2)", minWidth: 80,
                    }}
                  >
                    {completingId === s.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <CheckCircle2 size={11} strokeWidth={2.5} />}
                    {completingId === s.id ? "처리중" : "출석 완료"}
                  </button>
                ) : (
                  <span
                    className="text-[9px] font-cond font-bold leading-none px-2 py-1 rounded-full shrink-0"
                    style={
                      s.status === "completed"
                        ? { background: "rgba(211,255,82,0.12)", color: "var(--volt)" }
                        : { background: "var(--pt-3)", color: "var(--ink-3)" }
                    }
                  >
                    {s.status === "completed" ? "완료" : "결석"}
                  </span>
                )}

                {/* 완료 세션 → 운동 기록 입력 */}
                <button
                  onClick={() => onEditSession(s)}
                  className="tap-haptic w-8 h-8 rounded-lg bg-pt-3 flex items-center justify-center text-ink-2 hover:bg-pt-4 shrink-0"
                  title="운동 기록 입력/수정"
                >
                  <Dumbbell size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 숙제 관리 */}
      <section className="flex flex-col gap-4">
        <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
          이주의 숙제 관리
        </h2>

        {/* 상단 결론 요약 */}
        <div className="pt-card flex items-center justify-between" style={{ padding: 20 }}>
          <div>
            <p className="text-[10px] font-cond text-ink-3 mb-1">이번 주 배정 숙제</p>
            <p className="font-display text-ink-0 leading-none" style={{ fontSize: 18 }}>
              총 <span className="text-volt tabular-nums">{weekItems.length}개</span> 숙제 운영 중
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-cond text-ink-3 mb-1">회원 수행 현황</p>
            <p className="font-cond font-bold text-ink-0 text-sm tabular-nums">
              {weekCompleted}/{weekItems.length} 완료
            </p>
          </div>
        </div>

        {/* 새 숙제 추가 폼 */}
        <div className="pt-card flex flex-col gap-3" style={{ padding: 16 }}>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {HOMEWORK_CATEGORIES.map((tag) => {
              const active = newHwTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNewHwTag(tag)}
                  className="tap-haptic px-3 py-1.5 rounded-xl text-xs font-cond font-bold shrink-0 transition-colors"
                  style={
                    active
                      ? { background: "var(--volt)", color: "#000" }
                      : { background: "var(--pt-3)", border: "1px solid var(--pt-5)", color: "var(--ink-2)" }
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newHomework}
              onChange={(e) => setNewHomework(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHomework()}
              placeholder="이번 주 숙제 내용을 한 줄로 입력하세요"
              className="pt-input flex-1"
            />
            <button
              onClick={addHomework}
              disabled={savingHw}
              className="tap-haptic btn-volt shrink-0"
              style={{ minHeight: 48, padding: "0 16px" }}
            >
              <Plus size={16} strokeWidth={3} />
              추가
            </button>
          </div>
        </div>

        {/* 배정된 이주의 숙제 — 문구 바로 수정 가능 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-cond text-ink-3">항목 문구 바로 수정 가능</span>
        </div>

        {weekItems.length === 0 ? (
          <p className="text-ink-3 text-sm font-cond text-center py-4">
            이번 주 숙제가 없습니다
          </p>
        ) : (
          <div className="pt-card flex flex-col" style={{ padding: 0 }}>
            {weekItems.map((h, idx) => {
              const { category, text } = parseHomeworkCategory(h.content);
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 p-4"
                  style={
                    idx < weekItems.length - 1
                      ? { borderBottom: "1px solid rgba(255,255,255,0.06)" }
                      : undefined
                  }
                >
                  <button
                    onClick={() => toggleHomework(h)}
                    title={h.is_completed ? "완료 취소" : "완료로 표시 (회원이 깜빡했을 때 대신 체크)"}
                    className="tap-haptic shrink-0"
                  >
                    {h.is_completed ? (
                      <CheckCircle2 size={16} className="text-volt" />
                    ) : (
                      <Circle size={16} className="text-ink-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {category && (
                      <span
                        className="inline-block w-fit text-[9px] font-cond font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--ink-3)" }}
                      >
                        {category}
                      </span>
                    )}
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => editHomeworkText(h.id, e.target.value)}
                      onBlur={() => commitHomeworkText(h.id)}
                      className={`w-full bg-transparent text-sm font-cond font-semibold outline-none focus:bg-pt-2 focus:px-2 focus:py-1 rounded-lg transition-all ${
                        h.is_completed ? "text-ink-3 line-through" : "text-ink-0"
                      }`}
                    />
                  </div>
                  <button
                    onClick={() => removeHomework(h.id)}
                    aria-label="숙제 삭제"
                    className="tap-haptic w-8 h-8 flex items-center justify-center text-ink-3 hover:text-danger shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 지난 주차 수행 기록 (조회 전용) */}
        {pastHwWeeks.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider">지난 주차 수행 기록</p>
            <div className="pt-card flex flex-col" style={{ padding: 0 }}>
              {pastHwWeeks.map((week, idx) => {
                const done = week.items.filter((h) => h.is_completed).length;
                const total = week.items.length;
                const is100 = total > 0 && done === total;
                const isOpen = openPastWeek === week.weekStart;
                return (
                  <div
                    key={week.weekStart}
                    style={
                      idx < pastHwWeeks.length - 1
                        ? { borderBottom: "1px solid rgba(255,255,255,0.06)" }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setOpenPastWeek(isOpen ? null : week.weekStart)}
                      className="tap-haptic w-full px-4 py-3.5 flex items-center justify-between text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-cond font-bold text-ink-0">{week.weekLabel}</p>
                        <p className="text-[10px] font-cond text-ink-3 tabular-nums">{week.rangeLabel}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-sm font-cond font-bold tabular-nums"
                          style={{ color: is100 ? "var(--volt)" : "var(--ink-2)" }}
                        >
                          {done}/{total} 완료
                        </span>
                        {isOpen ? (
                          <ChevronUp size={16} className="text-ink-3" />
                        ) : (
                          <ChevronDown size={16} className="text-ink-3" />
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div
                        className="px-4 pb-3.5 pt-1 flex flex-col gap-1.5"
                        style={{ background: "rgba(0,0,0,0.3)" }}
                      >
                        {week.items.map((h) => {
                          const { category, text } = parseHomeworkCategory(h.content);
                          return (
                            <div key={h.id} className="flex items-center justify-between gap-3 text-xs py-1.5">
                              <span className={h.is_completed ? "text-ink-1" : "text-ink-4"}>
                                {category && <span className="text-ink-4 mr-1">[{category}]</span>}
                                {text}
                              </span>
                              <span
                                className="font-cond font-bold shrink-0"
                                style={{ color: h.is_completed ? "var(--volt)" : "var(--ink-4)" }}
                              >
                                {h.is_completed ? "완료" : "미완료"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 개인 운동 모니터링 피드 */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
            운동 기록 통합 피드
          </h2>
          <p className="text-[11px] font-cond text-ink-3 leading-none">
            회원이 기록한 PT·개인 운동을 모아보는 조회 전용 피드예요
          </p>
        </div>

        {feed.length === 0 ? (
          <div className="pt-card text-center py-8">
            <p className="text-ink-3 font-cond text-sm">운동 기록이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {feed.map((item, i) =>
              item.type === "pt" ? (
                <FeedCard
                  key={`pt-${item.session.id}`}
                  type="pt"
                  date={item.session.date}
                  title={item.session.title || "PT 수업"}
                  subtitle={`Session ${item.session.session_number ?? "?"}`}
                  records={item.records.map((r) => ({
                    label: r.exercise_name,
                    detail: `${r.sets ?? 0}세트 × ${r.reps ?? 0}회${r.weight ? ` @ ${r.weight}kg` : ""}`,
                  }))}
                  extra={item.session.feedback}
                />
              ) : (
                <FeedCard
                  key={`personal-${item.date}-${i}`}
                  type="personal"
                  date={item.date}
                  title={item.logs[0]?.workout_memo || "개인 운동"}
                  subtitle={`${item.logs.length}종목`}
                  records={item.logs.map((l) => ({
                    label: l.exercise_name,
                    detail: `${l.sets ?? 0}세트 × ${l.reps ?? 0}회`,
                  }))}
                  rpe={(() => {
                    const m = item.logs[0]?.memo?.match(/RPE (\d+)/);
                    return m ? parseInt(m[1]) : null;
                  })()}
                  condScore={item.logs[0]?.condition_score ?? null}
                />
              )
            )}
          </div>
        )}
      </section>

      {/* 활동 리포트 + 출석 추이 + 성장 캐릭터 진단 (회원 GROWTH·출석 탭과 동일 데이터, 캘린더는 홈 탭으로 통합됨) */}
      <section className="flex flex-col gap-6">
        <SectionTitle bar="none" en="ATTENDANCE & ANALYSIS" ko="출석 및 활동 분석 (회원 '출석' 탭과 동일)" />
        <AnalysisInsights
          member={member}
          sessions={sessions}
          recordsBySession={recordsBySession}
          personalLogs={personalLogs}
        />
      </section>

      {/* 근력 성장 전체 대시보드 */}
      {sessions.some((s) => s.status === "completed") && (
        <section className="flex flex-col gap-6">
          <SectionTitle bar="none" en="STRENGTH DASHBOARD" ko="회원 근력 성장 전체 현황" />

          {/* ① 밸런스 레이더 */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--pt-1)", border: "1px solid var(--pt-5)", padding: 16 }}
          >
            <MuscleBalanceRadar
              sessions={sessions}
              recordsBySession={recordsBySession}
              qualities={qualities}
            />
          </div>

          {/* ② 1RM 리포트 카드 (성별별 3대) */}
          {(() => {
            const SBD = member.gender === "female"
              ? ["스쿼트", "데드리프트", "숄더프레스"]
              : ["스쿼트", "데드리프트", "벤치프레스"];
            return (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">
                  1RM 리포트 (Brzycki 공식)
                </p>
                {SBD.map((name) => (
                  <OneRMReportCard
                    key={name}
                    exerciseName={name}
                    sessions={sessions}
                    recordsBySession={recordsBySession}
                    startDate={member.session_start_date}
                  />
                ))}
              </div>
            );
          })()}

          {/* ③ Hero SBD 차트 */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--pt-1)", border: "1px solid var(--pt-5)" }}
          >
            <HeroSBDChart
              sessions={sessions}
              recordsBySession={recordsBySession}
              benchmarks={benchmarks}
              gender={member.gender}
            />
          </div>

          {/* ④ 보조 종목 캐러셀 */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--pt-1)", border: "1px solid var(--pt-5)", padding: 16 }}
          >
            <SupportCarousel
              sessions={sessions}
              recordsBySession={recordsBySession}
              excludeNames={
                member.gender === "female"
                  ? ["스쿼트", "데드리프트", "숄더프레스"]
                  : ["스쿼트", "데드리프트", "벤치프레스"]
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TAB 3: MISSION — 트레이너 소견 + 주간 미션
   ════════════════════════════════════════════════════════════════ */
function MissionTab({
  member, homework, onUpdate,
}: {
  member: Member;
  homework: Homework[];
  onUpdate: () => void;
}) {
  const [assessment, setAssessment] = useState(member.trainer_assessment ?? "");
  const [mission, setMission] = useState(member.weekly_mission ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // member prop이 바뀌면 폼 값 동기화
  useEffect(() => {
    setAssessment(member.trainer_assessment ?? "");
    setMission(member.weekly_mission ?? "");
  }, [member.trainer_assessment, member.weekly_mission]);

  const save = async () => {
    if (!assessment.trim() && !mission.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({
        trainer_assessment: assessment.trim() || null,
        weekly_mission: mission.trim() || null,
      })
      .eq("id", member.id);
    setSaving(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    onUpdate();
  };

  const thisWeekHomework = homework.filter((h) => h.week_start === getWeekStartISO());
  const completedCount = thisWeekHomework.filter((h) => h.is_completed).length;

  /* 회원이 깜빡했을 때 트레이너가 대신 체크/해제 */
  const toggleHomework = async (hw: Homework) => {
    await supabase.from("homework").update({ is_completed: !hw.is_completed }).eq("id", hw.id);
    onUpdate();
  };

  return (
    <div className="px-5 flex flex-col gap-7">
      {/* 재활 소견 */}
      <section className="flex flex-col gap-4">
        <SectionTitle bar="volt" en="TRAINER ASSESSMENT" ko="재활 안정성 소견" />
        <div className="pt-card flex flex-col gap-4" style={{ padding: 22 }}>
          <p className="text-[10px] font-cond text-ink-3 leading-relaxed">
            현재는 회원 화면에 표시되지 않는 내부 기록용 메모입니다
          </p>
          <textarea
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="예: 요추 안정성 향상 중. 스쿼트 시 골반 틸팅 감소 확인..."
            className="pt-input"
            style={{ minHeight: 110, resize: "vertical", lineHeight: 1.7, paddingTop: 14 }}
          />
        </div>
      </section>

      {/* 이번 주 핵심 미션 */}
      <section className="flex flex-col gap-4">
        <SectionTitle bar="blue" en="WEEKLY MISSION" ko="이번 주 핵심 미션" />
        <div className="pt-card flex flex-col gap-4" style={{ padding: 22 }}>
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="예: 스쿼트 복압 유지 3초 버티기 + 수면 7시간 이상"
            className="pt-input"
            style={{ minHeight: 80, resize: "vertical", lineHeight: 1.7, paddingTop: 14 }}
          />
        </div>
      </section>

      {/* 저장 버튼 */}
      <button
        onClick={save}
        disabled={saving}
        className="tap-haptic rounded-2xl flex items-center justify-center gap-2.5 font-display tracking-wider"
        style={{
          minHeight: 60, fontSize: 16,
          background: savedFlash ? "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)" : "var(--grad-volt)",
          color: "#000",
          boxShadow: savedFlash
            ? "0 6px 24px rgba(74,222,128,0.4)"
            : "0 6px 24px var(--volt-glow-2), inset 0 1px 0 rgba(255,255,255,0.3)",
          transition: "background 0.3s, box-shadow 0.3s",
        }}
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : savedFlash ? (
          <CheckCircle2 size={18} strokeWidth={2.5} />
        ) : (
          <Save size={18} strokeWidth={2.5} />
        )}
        {saving ? "저장 중..." : savedFlash ? "✓ 저장됨! 회원 앱에 즉시 반영" : "소견 & 미션 저장"}
      </button>

      {/* 숙제 완료 현황 (이번 주) */}
      {thisWeekHomework.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
            이번 주 숙제 완료 현황
          </h2>
          <div className="pt-card flex flex-col gap-3" style={{ padding: 20 }}>
            <div className="flex items-center justify-between">
              <p className="font-display text-volt leading-none" style={{ fontSize: 28 }}>
                {completedCount}
                <span className="text-ink-3 text-base ml-1">/ {thisWeekHomework.length}</span>
              </p>
              <span className="text-xs font-cond text-ink-2">
                {Math.round((completedCount / thisWeekHomework.length) * 100)}% 완료
              </span>
            </div>
            {thisWeekHomework.map((h) => {
              const { category, text } = parseHomeworkCategory(h.content);
              return (
                <div key={h.id} className="flex items-center gap-3 py-2 border-b border-pt-5 last:border-0">
                  <button
                    onClick={() => toggleHomework(h)}
                    title={h.is_completed ? "완료 취소" : "완료로 표시 (회원이 깜빡했을 때 대신 체크)"}
                    className={`tap-haptic w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                      h.is_completed ? "border-volt bg-volt" : "border-pt-6 bg-transparent"
                    }`}
                  >
                    {h.is_completed && <Check size={11} strokeWidth={3} color="#000" />}
                  </button>
                  <span className={`text-sm font-cond leading-relaxed flex-1 ${h.is_completed ? "text-ink-3 line-through" : "text-ink-0"}`}>
                    {category && <span className="text-ink-4 mr-1">[{category}]</span>}
                    {text}
                  </span>
                  {h.is_completed && <CheckCircle2 size={13} className="text-volt shrink-0" />}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TAB 4: BODY — 인바디 입력 + 이력
   ════════════════════════════════════════════════════════════════ */
function BodyTab({
  memberId, bodyHistory, member, onUpdate,
}: {
  memberId: string;
  bodyHistory: BodyMeasurement[];
  member: Member;
  onUpdate: () => void;
}) {
  const emptyForm = {
    measured_at: getTodayISO(),
    weight_kg: "", skeletal_muscle_kg: "", body_fat_kg: "",
    body_fat_pct: "", whr: "", bmr_kcal: "", note: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    const payload = {
      member_id: memberId,
      measured_at: form.measured_at || getTodayISO(),
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      skeletal_muscle_kg: form.skeletal_muscle_kg ? Number(form.skeletal_muscle_kg) : null,
      body_fat_kg: form.body_fat_kg ? Number(form.body_fat_kg) : null,
      body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null,
      whr: form.whr ? Number(form.whr) : null,
      bmr_kcal: form.bmr_kcal ? Number(form.bmr_kcal) : null,
      note: form.note.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("body_measurements").update(payload).eq("id", editingId)
      : await supabase.from("body_measurements").insert(payload);
    setSaving(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    setForm(emptyForm);
    setEditingId(null);
    onUpdate();
  };

  const loadForEdit = (b: BodyMeasurement) => {
    setEditingId(b.id);
    setForm({
      measured_at: b.measured_at,
      weight_kg: b.weight_kg?.toString() ?? "",
      skeletal_muscle_kg: b.skeletal_muscle_kg?.toString() ?? "",
      body_fat_kg: b.body_fat_kg?.toString() ?? "",
      body_fat_pct: b.body_fat_pct?.toString() ?? "",
      whr: b.whr?.toString() ?? "",
      bmr_kcal: b.bmr_kcal?.toString() ?? "",
      note: b.note ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const deleteMeasurement = async (id: string) => {
    if (!confirm("이 인바디 기록을 삭제할까요?")) return;
    await supabase.from("body_measurements").delete().eq("id", id);
    if (editingId === id) cancelEdit();
    onUpdate();
  };

  /** 트레이너는 body_measurements 전체 접근 권한이 있으므로 직접 insert */
  const saveFromPhoto = async (values: InBodyValues) => {
    const { error } = await supabase.from("body_measurements").insert({
      member_id: memberId,
      measured_at: values.measured_at || getTodayISO(),
      weight_kg: values.weight_kg,
      skeletal_muscle_kg: values.skeletal_muscle_kg,
      body_fat_kg: values.body_fat_kg,
      body_fat_pct: values.body_fat_pct,
      whr: values.whr,
      bmr_kcal: values.bmr_kcal,
      note: "트레이너가 사진으로 기록",
    });
    if (error) return { error: error.message };
    return {};
  };

  const latest = bodyHistory[0] ?? null;
  const ageGroup = getAgeGroup(member.birth_date);
  const gender = member.gender ?? "male";

  // ACSM 기준 (Good 등급 기준값 표시용)
  const ACSM_GOOD = {
    male:   { fat: 22, smm: 35 },
    female: { fat: 28, smm: 23 },
  }[gender];

  return (
    <div className="px-5 flex flex-col gap-7">
      {/* 사진으로 기록하기 */}
      <section className="flex flex-col gap-4">
        <SectionTitle bar="volt" en="PHOTO SCAN" ko="인바디 결과지 사진으로 기록" />
        <InBodyPhotoCapture onSave={saveFromPhoto} onSaved={onUpdate} label="사진으로 기록하기" />
      </section>

      {/* 입력 폼 */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle bar="volt" en="NEW MEASUREMENT" ko={editingId ? "인바디 수치 수정" : "인바디 수치 직접 입력"} />
          {editingId && (
            <button
              onClick={cancelEdit}
              className="tap-haptic flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-cond font-bold text-ink-3 shrink-0"
              style={{ background: "var(--pt-3)" }}
            >
              <XIcon size={11} />
              취소
            </button>
          )}
        </div>
        <div className="pt-card flex flex-col gap-5" style={{ padding: 22 }}>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-cond text-ink-3 uppercase tracking-wider leading-none">측정 날짜</label>
            <Input type="date" value={form.measured_at} onChange={(e) => setForm((f) => ({ ...f, measured_at: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              ["체중", "weight_kg", "kg"],
              ["골격근량", "skeletal_muscle_kg", "kg"],
              ["체지방량", "body_fat_kg", "kg"],
              ["체지방률", "body_fat_pct", "%"],
              ["WHR (복부지방률)", "whr", ""],
              ["기초대사량 BMR", "bmr_kcal", "kcal"],
            ] as const).map(([label, key, unit]) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-[9px] font-cond text-ink-3 uppercase tracking-wider leading-none">
                  {label}{unit && <span className="text-ink-4 ml-1">({unit})</span>}
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="pt-input text-center"
                  style={{ fontSize: 18 }}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-cond text-ink-3 uppercase tracking-wider leading-none">메모</label>
            <Input placeholder="측정 관련 메모..." value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="tap-haptic rounded-2xl flex items-center justify-center gap-2.5 font-display tracking-wider"
            style={{
              minHeight: 56, fontSize: 15,
              background: savedFlash ? "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)" : "var(--grad-volt)",
              color: "#000",
              boxShadow: savedFlash ? "0 0 20px rgba(74,222,128,0.4)" : "0 6px 20px var(--volt-glow-2)",
              transition: "background 0.3s",
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : savedFlash ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saving
              ? "저장 중..."
              : savedFlash
              ? "✓ 저장됨! Body 탭에 즉시 반영"
              : editingId
              ? "수정 완료 → ACSM 자동 연산"
              : "인바디 저장 → ACSM 자동 연산"}
          </button>
        </div>
      </section>

      {/* 최신 수치 + ACSM 목표 갭 */}
      {latest && (
        <section className="flex flex-col gap-4">
          <SectionTitle bar="blue" en="CURRENT vs ACSM GOAL" ko="최신 수치 vs ACSM Good 목표" />
          <div className="pt-card flex flex-col gap-4" style={{ padding: 22 }}>
            <p className="text-[10px] font-cond text-ink-3 leading-none">
              최근 측정: {latest.measured_at} ·{" "}
              {gender === "male" ? "남성" : "여성"} {ageGroup} 기준
            </p>

            {latest.body_fat_pct !== null && (
              <GapBar
                label="체지방률"
                current={latest.body_fat_pct}
                target={ACSM_GOOD.fat}
                unit="%"
                lowerIsBetter
              />
            )}
            {latest.skeletal_muscle_kg !== null && (
              <GapBar
                label="골격근량"
                current={latest.skeletal_muscle_kg}
                target={ACSM_GOOD.smm}
                unit="kg"
                lowerIsBetter={false}
              />
            )}
            {latest.whr !== null && (
              <GapBar
                label="WHR"
                current={latest.whr}
                target={gender === "male" ? 0.85 : 0.80}
                unit=""
                lowerIsBetter
              />
            )}
          </div>
        </section>
      )}

      {/* 측정 이력 */}
      {bodyHistory.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle bar="volt" en="MEASUREMENT HISTORY" ko="인바디 측정 이력" />
          <div className="flex flex-col gap-2.5">
            {bodyHistory.map((b) => (
              <div
                key={b.id}
                className="pt-card flex flex-col gap-3"
                style={{ padding: 18, border: editingId === b.id ? "1px solid var(--volt)" : undefined }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-cond font-bold text-ink-0 text-sm leading-none tabular-nums shrink-0">{b.measured_at}</p>
                    {b.note && <p className="text-[10px] font-cond text-ink-3 leading-none italic truncate">{b.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => loadForEdit(b)}
                      aria-label="수정"
                      className="tap-haptic w-7 h-7 rounded-lg flex items-center justify-center text-ink-3"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteMeasurement(b.id)}
                      aria-label="삭제"
                      className="tap-haptic w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(255,59,59,0.08)", color: "var(--danger)" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {b.weight_kg !== null && <Metric label="체중" value={`${b.weight_kg}kg`} />}
                  {b.skeletal_muscle_kg !== null && <Metric label="골격근" value={`${b.skeletal_muscle_kg}kg`} color="var(--volt)" />}
                  {b.body_fat_pct !== null && <Metric label="체지방률" value={`${b.body_fat_pct}%`} color="#ff8c00" />}
                  {b.whr !== null && <Metric label="WHR" value={`${b.whr}`} />}
                  {b.bmr_kcal !== null && <Metric label="BMR" value={`${b.bmr_kcal}kcal`} color="#5BA8FF" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   공통 서브 컴포넌트
   ════════════════════════════════════════════════════════════════ */

function SectionTitle({ bar, en, ko }: { bar: "volt" | "blue" | "pink" | "none"; en: string; ko: string }) {
  const barEl =
    bar === "volt" ? <span className="section-bar" /> :
    bar === "blue" ? <span className="section-bar-blue" /> :
    bar === "none" ? null :
    <span className="section-bar-pink" />;
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="section-title" style={{ fontSize: 20 }}>
        {barEl}
        {en}
      </h2>
      <p className="text-[11px] font-cond text-ink-3 leading-none ml-5">{ko}</p>
    </div>
  );
}

function FeedCard({
  type, date, title, subtitle, records, extra, rpe, condScore,
}: {
  type: "pt" | "personal";
  date: string;
  title: string;
  subtitle: string;
  records: { label: string; detail: string }[];
  extra?: string | null;
  rpe?: number | null;
  condScore?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const isPT = type === "pt";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(18,18,18,0.85)",
        backdropFilter: "blur(12px)",
        border: open
          ? `1px solid ${isPT ? "var(--volt-glow-2)" : "rgba(91,168,255,0.3)"}`
          : "1px solid var(--pt-5)",
      }}
    >
      <button onClick={() => setOpen((v) => !v)} className="tap-haptic w-full flex items-center gap-3 p-4 text-left">
        <span
          className="px-2.5 py-1.5 rounded-lg font-cond font-bold text-[9px] tracking-wider leading-none shrink-0"
          style={
            isPT
              ? { background: "rgba(211,255,82,0.15)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }
              : { background: "rgba(91,168,255,0.12)", color: "#5BA8FF", border: "1px solid rgba(91,168,255,0.3)" }
          }
        >
          {isPT ? "PT 수업" : "개인 운동"}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="text-[10px] font-cond text-ink-3 leading-none">{formatShortKoreanDate(date)}</p>
          <p className="font-cond font-bold text-ink-0 text-sm leading-tight truncate">{title}</p>
          <p className="text-[10px] font-cond text-ink-3 leading-none">{subtitle}</p>
        </div>
        {open ? <ChevronUp size={14} className="text-ink-3 shrink-0" /> : <ChevronDown size={14} className="text-ink-3 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-pt-5 pt-3 flex flex-col gap-2 anim-fade-slide">
          {records.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-pt-5 last:border-0">
              <span className="font-cond font-bold text-ink-0 text-sm">{r.label}</span>
              <span className="text-ink-2 text-xs font-cond shrink-0">{r.detail}</span>
            </div>
          ))}
          {(rpe || condScore) && (
            <div className="flex gap-4 px-1 pt-1">
              {rpe && (
                <span className="text-[10px] font-cond text-ink-3">
                  RPE <b className="text-volt">{rpe}</b>
                </span>
              )}
              {condScore && (
                <span className="text-[10px] font-cond text-ink-3">
                  컨디션 <b style={{ color: "#5BA8FF" }}>{condScore}</b>
                </span>
              )}
            </div>
          )}
          {extra && (
            <div className="mt-1 rounded-xl p-3" style={{ background: "rgba(211,255,82,0.06)", border: "1px solid var(--volt-glow-2)" }}>
              <p className="text-[9px] text-volt font-cond font-bold uppercase tracking-wider mb-1.5 leading-none">피드백</p>
              <p className="text-xs text-ink-1 leading-relaxed">{extra}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GapBar({
  label, current, target, unit, lowerIsBetter,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  lowerIsBetter: boolean;
}) {
  const achieved = lowerIsBetter ? current <= target : current >= target;
  const pct = lowerIsBetter
    ? Math.min(100, Math.max(0, (target / Math.max(current, 0.01)) * 100))
    : Math.min(100, Math.max(0, (current / Math.max(target, 0.01)) * 100));
  const gap = Math.abs(target - current);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-cond text-ink-2 leading-none">{label}</p>
        <div className="flex items-center gap-2">
          <span className="font-display tabular-nums leading-none" style={{ fontSize: 15, color: achieved ? "var(--volt)" : "var(--ink-0)" }}>
            {current}{unit}
          </span>
          <span className="text-[10px] font-cond text-ink-3 leading-none">→ 목표 {target}{unit}</span>
          {!achieved && (
            <span className="text-[10px] font-cond font-bold leading-none" style={{ color: lowerIsBetter ? "#ff8c00" : "var(--volt)" }}>
              {lowerIsBetter ? `↓${gap.toFixed(1)}` : `↑${gap.toFixed(1)}`}{unit}
            </span>
          )}
          {achieved && <CheckCircle2 size={12} className="text-volt" />}
        </div>
      </div>
      <div className="progress-track" style={{ height: 8 }}>
        <div
          className="progress-fill"
          style={{
            width: `${pct}%`,
            background: achieved ? "var(--grad-volt-bar)" : "linear-gradient(90deg, #ff8c00 0%, #ffb347 100%)",
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] font-cond text-ink-3 leading-none">{label}</span>
      <span className="font-display tabular-nums leading-none" style={{ fontSize: 14, color: color ?? "var(--ink-0)" }}>{value}</span>
    </div>
  );
}
