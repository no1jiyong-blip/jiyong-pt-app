import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const EMAIL_DOMAIN = "ptcoachpro.internal";

/** username은 실제 이메일이 아니므로, Supabase Auth용 가짜 이메일을 만들어 씀 */
function syntheticEmail(username: string) {
  return `${username}@${EMAIL_DOMAIN}`;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "인증 정보가 없습니다" }, { status: 401 });
    }

    // 호출자가 실제로 로그인된 트레이너인지 검증
    const { data: callerAuth, error: callerErr } =
      await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerAuth.user) {
      return NextResponse.json({ error: "인증에 실패했습니다" }, { status: 401 });
    }
    const { data: callerProfile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", callerAuth.user.id)
      .maybeSingle();
    if (callerProfile?.role !== "trainer") {
      return NextResponse.json({ error: "트레이너만 회원을 추가할 수 있습니다" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, phone, goal, startDate, totalSessions, notes,
      gender, birthDate, username, password,
    } = body;

    if (!name?.trim() || !username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "이름, 아이디, 비밀번호는 필수입니다" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username", username.trim())
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다" }, { status: 409 });
    }

    // 1) 회원 데이터 먼저 생성
    const { data: member, error: mErr } = await supabaseAdmin
      .from("members")
      .insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        goal: goal?.trim() || null,
        start_date: startDate,
        session_start_date: startDate,
        total_sessions: totalSessions,
        used_sessions: 0,
        notes: notes?.trim() || null,
        gender: gender || null,
        birth_date: birthDate || null,
      })
      .select()
      .single();

    if (mErr || !member) {
      return NextResponse.json({ error: "회원 등록 실패" }, { status: 500 });
    }

    // 2) Supabase Auth 계정 생성
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail(username.trim()),
      password: password.trim(),
      email_confirm: true,
    });

    if (authErr || !authUser.user) {
      // 롤백: 방금 만든 회원 데이터 삭제
      await supabaseAdmin.from("members").delete().eq("id", member.id);
      return NextResponse.json({ error: "계정 생성 실패: " + (authErr?.message ?? "") }, { status: 500 });
    }

    // 3) users 프로필 (id = auth 계정 id)
    const { error: uErr } = await supabaseAdmin.from("users").insert({
      id: authUser.user.id,
      username: username.trim(),
      role: "member",
      member_id: member.id,
    });

    if (uErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("members").delete().eq("id", member.id);
      return NextResponse.json({ error: "프로필 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ member });
  } catch (e) {
    return NextResponse.json({ error: "서버 오류: " + String(e) }, { status: 500 });
  }
}
