"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, LogOut } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, logout } from "@/lib/auth";
import type { Member, Session } from "@/lib/types";
import { formatKoreanDate, getTodayISO } from "@/lib/utils";
import { Calendar } from "@/components/trainer/Calendar";
import { RosterCard } from "@/components/trainer/RosterCard";
import { LiveRecordModal } from "@/components/trainer/LiveRecordModal";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

export default function TrainerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [liveSession, setLiveSession] = useState<Session | null>(null);
  const [liveMember, setLiveMember] = useState<Member | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const loadData = useCallback(async () => {
    const { data: m } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: true });
    setMembers((m ?? []) as Member[]);

    const { data: s } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: true });
    setSessions((s ?? []) as Session[]);
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "trainer") {
      router.replace("/member");
      return;
    }
    loadData().finally(() => setLoading(false));
  }, [router, loadData]);

  const todaysSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    [sessions, selectedDate]
  );

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pt-0">
        <p className="font-display text-3xl tracking-wide-3 text-volt anim-pulse">
          LOADING...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-pt-0">
      <div className="pt-container pb-16">
        {/* Header */}
        <header className="px-6 pt-10 pb-2 flex items-start justify-between gap-3 safe-pt">
          <div className="flex flex-col gap-3 min-w-0">
            <p className="font-display text-volt text-sm tracking-wide-2 leading-none">
              TRAINER
            </p>
            <h1 className="font-display text-3xl text-ink-0 tracking-wider leading-none">
              스케줄 관리
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <button
              onClick={() => setShowAddMember(true)}
              className="w-12 h-12 rounded-full flex items-center justify-center glow-volt-strong"
              style={{ background: "var(--grad-volt)", color: "#000" }}
              aria-label="새 회원 등록"
            >
              <Users size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={handleLogout}
              className="w-12 h-12 rounded-full flex items-center justify-center text-ink-2 hover:text-ink-0 hover:bg-pt-3 transition-colors"
              aria-label="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="section-stack mt-12">
          {/* Calendar + Roster grid */}
          <div className="px-6 grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8">
            {/* LEFT */}
            <div className="flex flex-col gap-5">
              <Calendar
                sessions={sessions}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              <div className="pt-card flex flex-col gap-3">
                <p className="text-xs text-ink-2 font-cond tracking-wide-2 uppercase leading-none">
                  선택된 날짜
                </p>
                <p className="font-display text-2xl text-ink-0 tracking-wider leading-none">
                  {formatKoreanDate(selectedDate)}
                </p>
                <p className="font-display text-volt text-sm leading-none mt-1">
                  {todaysSessions.length}개의 수업 예정
                </p>
              </div>

              <button
                onClick={() => setShowAddSession(true)}
                className="btn-ghost"
                style={{ padding: "16px 24px", minHeight: 56 }}
              >
                <Plus size={16} />
                수업 일정 추가
              </button>
            </div>

            {/* RIGHT: Roster */}
            <section className="flex flex-col gap-6">
              <h2 className="section-title">
                <span className="section-bar"></span>
                예정된 수업
                <span className="ml-2 text-sm text-ink-2 font-cond leading-none">
                  {todaysSessions.length}명
                </span>
              </h2>

              {todaysSessions.length === 0 ? (
                <div className="pt-card text-center py-12">
                  <p className="text-ink-3 font-cond">예정된 수업이 없습니다</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {todaysSessions.map((s) => {
                    const m = members.find((mm) => mm.id === s.member_id);
                    if (!m) return null;
                    return (
                      <RosterCard
                        key={s.id}
                        member={m}
                        session={s}
                        onUpdate={loadData}
                        onOpenLiveRecord={() => {
                          setLiveSession(s);
                          setLiveMember(m);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* All members */}
          <section className="px-6 flex flex-col gap-6">
            <h2 className="section-title">
              <span className="section-bar-blue"></span>
              전체 회원
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/trainer/member/${m.id}`}
                  className="pt-card hover:border-volt-soft transition-colors flex items-center gap-4"
                >
                  <Avatar name={m.name} size={52} />
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <p className="font-cond font-bold text-ink-0 text-base leading-none">
                      {m.name}
                    </p>
                    <p className="text-xs text-ink-2 font-cond leading-none">
                      잔여{" "}
                      <span className="text-volt font-bold">
                        {m.total_sessions - m.used_sessions}
                      </span>{" "}
                      / {m.total_sessions}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      {liveSession && liveMember && (
        <LiveRecordModal
          session={liveSession}
          memberName={liveMember.name}
          onClose={() => {
            setLiveSession(null);
            setLiveMember(null);
          }}
          onSaved={loadData}
        />
      )}

      {showAddSession && (
        <AddSessionModal
          members={members}
          defaultDate={selectedDate}
          onClose={() => setShowAddSession(false)}
          onSaved={loadData}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          onClose={() => setShowAddMember(false)}
          onSaved={loadData}
        />
      )}
    </main>
  );
}

/* ─── Add Session Modal ──────────────────── */
function AddSessionModal({
  members,
  defaultDate,
  onClose,
  onSaved,
}: {
  members: Member[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!memberId) return;
    setSaving(true);

    const { data: existing } = await supabase
      .from("sessions")
      .select("session_number")
      .eq("member_id", memberId)
      .order("session_number", { ascending: false })
      .limit(1);

    const nextNum =
      existing && existing.length > 0
        ? (existing[0].session_number ?? 0) + 1
        : 1;

    await supabase.from("sessions").insert({
      member_id: memberId,
      date,
      time,
      status: "scheduled",
      session_number: nextNum,
    });

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full md:max-w-md bg-pt-3 anim-fade-slide flex flex-col gap-5 p-7 safe-pb"
        style={{
          border: "1px solid var(--volt-glow-2)",
          borderRadius: "24px 24px 0 0",
        }}
      >
        <h3 className="font-display text-2xl text-ink-0 tracking-wider leading-none">
          새 수업 일정
        </h3>

        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
            회원
          </label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="pt-input"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              날짜
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              시간
            </label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="btn-volt"
            style={{ minHeight: 56 }}
          >
            {saving ? "추가 중..." : "추가"}
          </button>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ minHeight: 56 }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Member Modal ── 성별/생년월일 신규 ─── */
function AddMemberModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("");
  const [totalSessions, setTotalSessions] = useState(20);
  const [startDate, setStartDate] = useState(getTodayISO());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      setError("이름, 아이디, 비밀번호는 필수입니다");
      return;
    }
    setSaving(true);
    setError("");

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.trim())
      .maybeSingle();
    if (existing) {
      setError("이미 사용 중인 아이디입니다");
      setSaving(false);
      return;
    }

    const { data: member, error: mErr } = await supabase
      .from("members")
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        goal: goal.trim() || null,
        start_date: startDate,
        session_start_date: startDate,
        total_sessions: totalSessions,
        used_sessions: 0,
        notes: notes.trim() || null,
        gender: gender || null,
        birth_date: birthDate || null,
      })
      .select()
      .single();

    if (mErr || !member) {
      setError("회원 등록 실패");
      setSaving(false);
      return;
    }

    await supabase.from("users").insert({
      username: username.trim(),
      password: password.trim(),
      role: "member",
      member_id: member.id,
    });

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full md:max-w-md max-h-[92vh] overflow-y-auto bg-pt-3 anim-fade-slide flex flex-col gap-4 p-7 safe-pb"
        style={{
          border: "1px solid var(--volt-glow-2)",
          borderRadius: "24px 24px 0 0",
        }}
      >
        <h3 className="font-display text-2xl text-ink-0 tracking-wider leading-none">
          새 회원 등록
        </h3>

        <Input
          placeholder="이름 *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="아이디 *"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            placeholder="비밀번호 *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* 성별 / 생년월일 — NEW */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              성별
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "male" | "female" | "")}
              className="pt-input"
            >
              <option value="">선택안함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              생년월일
            </label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
        </div>

        <Input
          placeholder="전화번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          placeholder="운동 목표"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              총 세션
            </label>
            <Input
              type="number"
              value={totalSessions}
              onChange={(e) => setTotalSessions(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              시작일
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <Input
          placeholder="특이사항 / 부상 이력"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <div className="text-sm text-danger font-cond bg-danger-soft border border-danger px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="btn-volt"
            style={{ minHeight: 56 }}
          >
            {saving ? "등록 중..." : "등록"}
          </button>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ minHeight: 56 }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
