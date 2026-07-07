"use client";

import { useState } from "react";
import {
  Check,
  X,
  Clock,
  CalendarDays,
  Play,
  Trash2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Member, Session } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

interface Props {
  member: Member;
  session: Session;
  onUpdate: () => void;
  onOpenLiveRecord: () => void;
}

export function RosterCard({
  member,
  session,
  onUpdate,
  onOpenLiveRecord,
}: Props) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(session.date);
  const [newTime, setNewTime] = useState(session.time ?? "10:00");
  const [busy, setBusy] = useState<string | null>(null);

  const remaining = member.total_sessions - member.used_sessions;

  const updateStatus = async (newStatus: "completed" | "cancelled") => {
    if (busy) return;
    setBusy(newStatus);

    await supabase
      .from("sessions")
      .update({ status: newStatus })
      .eq("id", session.id);

    if (session.status !== "completed" && newStatus === "completed") {
      await supabase
        .from("members")
        .update({
          used_sessions: Math.min(
            member.total_sessions,
            member.used_sessions + 1
          ),
        })
        .eq("id", member.id);
    } else if (session.status === "completed" && newStatus !== "completed") {
      await supabase
        .from("members")
        .update({
          used_sessions: Math.max(0, member.used_sessions - 1),
        })
        .eq("id", member.id);
    }

    setBusy(null);
    onUpdate();
  };

  const reschedule = async () => {
    setBusy("reschedule");
    await supabase
      .from("sessions")
      .update({ date: newDate, time: newTime })
      .eq("id", session.id);
    setBusy(null);
    setShowReschedule(false);
    onUpdate();
  };

  const deleteSession = async () => {
    if (!confirm("이 수업을 삭제하시겠습니까?")) return;
    setBusy("delete");
    await supabase.from("sessions").delete().eq("id", session.id);
    setBusy(null);
    onUpdate();
  };

  return (
    <div className="pt-card flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar name={member.name} size={48} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <p className="font-cond font-bold text-ink-0 text-base leading-none">
            {member.name}
          </p>
          <p className="text-ink-2 text-xs font-cond flex items-center gap-2 leading-none">
            <Clock size={12} />
            {session.time ?? "—"}
            <span className="text-ink-3">|</span>
            <span>Session {session.session_number ?? "?"}</span>
          </p>
        </div>
        {session.status === "completed" && (
          <span
            className="px-3 py-1.5 rounded-full text-[10px] font-cond font-bold tracking-wider leading-none shrink-0"
            style={{
              background: "var(--volt-glow)",
              color: "var(--volt)",
            }}
          >
            완료
          </span>
        )}
        {session.status === "cancelled" && (
          <span className="px-3 py-1.5 rounded-full bg-pt-2 text-ink-2 text-[10px] font-cond font-bold tracking-wider leading-none shrink-0">
            결석
          </span>
        )}
      </div>

      {/* Remaining */}
      <div
        className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3"
        style={{
          background: "linear-gradient(135deg, var(--pt-2) 0%, var(--pt-3) 100%)",
          border: "1px solid var(--pt-5)",
        }}
      >
        <span className="text-xs text-ink-2 font-cond leading-none tracking-wider uppercase">
          잔여 횟수
        </span>
        <span className="font-display flex items-baseline gap-1.5 leading-none">
          <span className="text-volt text-2xl">{remaining}</span>
          <span className="text-ink-3 text-sm">/ {member.total_sessions}</span>
        </span>
      </div>

      {/* 출석 / 결석 — grid-cols-2 gap-3 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => updateStatus("completed")}
          disabled={busy !== null || session.status === "completed"}
          className="bg-pt-2 hover:bg-pt-4 disabled:opacity-40 rounded-xl flex items-center justify-center gap-2 font-cond font-bold text-sm text-ink-0 transition-colors border border-pt-5"
          style={{ minHeight: 52 }}
        >
          {busy === "completed" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          출석완료
        </button>
        <button
          onClick={() => updateStatus("cancelled")}
          disabled={busy !== null || session.status === "cancelled"}
          className="bg-pt-2 hover:bg-pt-4 disabled:opacity-40 rounded-xl flex items-center justify-center gap-2 font-cond font-bold text-sm text-ink-0 transition-colors border border-pt-5"
          style={{ minHeight: 52 }}
        >
          {busy === "cancelled" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <X size={16} />
          )}
          결석처리
        </button>
      </div>

      {/* Reschedule + Delete */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowReschedule((v) => !v)}
          className="flex-1 bg-pt-2 hover:bg-pt-4 rounded-xl flex items-center justify-center gap-2 font-cond font-bold text-sm text-ink-1 transition-colors border border-pt-5"
          style={{ minHeight: 52 }}
        >
          <CalendarDays size={16} />
          일정 변경
        </button>
        <button
          onClick={deleteSession}
          disabled={busy !== null}
          className="rounded-xl flex items-center justify-center transition-colors"
          style={{
            backgroundColor: "var(--danger-glow)",
            border: "1px solid rgba(255,59,59,0.3)",
            color: "var(--danger)",
            width: 52,
            minHeight: 52,
          }}
        >
          {busy === "delete" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>

      {showReschedule && (
        <div className="bg-pt-2 rounded-xl p-5 flex flex-col gap-4 anim-fade-slide border border-pt-5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={reschedule}
              disabled={busy !== null}
              className="btn-volt"
              style={{ minHeight: 48 }}
            >
              저장
            </button>
            <button
              onClick={() => setShowReschedule(false)}
              className="btn-ghost"
              style={{ minHeight: 48 }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Live record */}
      <button
        onClick={onOpenLiveRecord}
        className="rounded-xl flex items-center justify-center gap-2 font-cond font-bold text-sm transition-colors"
        style={{
          background: "var(--grad-volt)",
          color: "#000",
          minHeight: 52,
          boxShadow: "0 4px 18px var(--volt-glow)",
        }}
      >
        <Play size={14} fill="#000" />
        실시간 운동 기록
      </button>
    </div>
  );
}
