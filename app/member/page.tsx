"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type {
  Member,
  Session,
  ExerciseRecord,
  Homework,
  PersonalLog,
} from "@/lib/types";
import { getWeekStartISO } from "@/lib/utils";
import { PageHeader } from "@/components/shared/Header";
import { BottomNav, type TabKey } from "@/components/member/BottomNav";
import { HomeTab } from "@/components/member/tabs/HomeTab";
import { WorkoutTab } from "@/components/member/tabs/WorkoutTab";
import { GrowthTab } from "@/components/member/tabs/GrowthTab";
import { MissionTab } from "@/components/member/tabs/MissionTab";

export default function MemberDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("home");

  const [member, setMember] = useState<Member | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recordsBySession, setRecordsBySession] = useState<
    Record<string, ExerciseRecord[]>
  >({});
  const [homework, setHomework] = useState<Homework[]>([]);
  const [personalLogs, setPersonalLogs] = useState<PersonalLog[]>([]);

  const loadData = useCallback(async (memberId: string) => {
    const { data: m } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle();
    if (!m) return;
    setMember(m as Member);

    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .eq("member_id", memberId)
      .order("date", { ascending: false });
    const sessList = (sess ?? []) as Session[];
    setSessions(sessList);

    if (sessList.length > 0) {
      const ids = sessList.map((s) => s.id);
      const { data: recs } = await supabase
        .from("exercise_records")
        .select("*")
        .in("session_id", ids);
      const grouped: Record<string, ExerciseRecord[]> = {};
      (recs ?? []).forEach((r: ExerciseRecord) => {
        if (!grouped[r.session_id]) grouped[r.session_id] = [];
        grouped[r.session_id].push(r);
      });
      setRecordsBySession(grouped);
    }

    const weekStart = getWeekStartISO();
    const { data: hw } = await supabase
      .from("homework")
      .select("*")
      .eq("member_id", memberId)
      .eq("week_start", weekStart)
      .order("created_at", { ascending: true });
    setHomework((hw ?? []) as Homework[]);

    const { data: pl } = await supabase
      .from("personal_logs")
      .select("*")
      .eq("member_id", memberId)
      .order("log_date", { ascending: false });
    setPersonalLogs((pl ?? []) as PersonalLog[]);
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "member" || !user.member_id) {
      router.replace("/trainer");
      return;
    }
    loadData(user.member_id).finally(() => setLoading(false));
  }, [router, loadData]);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const refresh = useCallback(() => {
    if (member) loadData(member.id);
  }, [member, loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pt-0">
        <p className="font-display text-3xl tracking-wide-3 text-volt anim-pulse">
          LOADING...
        </p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pt-0 px-6">
        <p className="text-ink-2 font-cond text-center">
          회원 정보를 불러올 수 없습니다
        </p>
      </div>
    );
  }

  const trainerNote =
    sessions.find((s) => s.trainer_note && s.trainer_note.trim())
      ?.trainer_note ?? null;

  return (
    <main className="min-h-screen bg-pt-0">
      <div className="pt-container with-bottom-nav">
        <PageHeader
          greeting="WELCOME"
          name={`${member.name}님`}
          rightInfo={`${member.total_sessions}회 등록`}
        />

        <div className="mt-8">
          {activeTab === "home" && (
            <HomeTab
              member={member}
              sessions={sessions}
              recordsBySession={recordsBySession}
            />
          )}

          {activeTab === "workout" && (
            <WorkoutTab
              member={member}
              sessions={sessions}
              recordsBySession={recordsBySession}
              personalLogs={personalLogs}
              onUpdate={refresh}
            />
          )}

          {activeTab === "growth" && (
            <GrowthTab
              member={member}
              sessions={sessions}
              recordsBySession={recordsBySession}
              personalLogs={personalLogs}
            />
          )}

          {activeTab === "mission" && (
            <MissionTab
              homework={homework}
              trainerNote={trainerNote}
              onUpdate={refresh}
            />
          )}
        </div>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </main>
  );
}
