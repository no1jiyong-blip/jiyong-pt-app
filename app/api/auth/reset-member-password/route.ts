import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
      return NextResponse.json({ error: "트레이너만 비밀번호를 재설정할 수 있습니다" }, { status: 403 });
    }

    const { memberId, newPassword } = await req.json();
    if (!memberId || !newPassword?.trim() || newPassword.trim().length < 4) {
      return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다" }, { status: 400 });
    }

    const { data: memberUser, error: findErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("member_id", memberId)
      .maybeSingle();
    if (findErr || !memberUser) {
      return NextResponse.json({ error: "해당 회원의 로그인 계정을 찾을 수 없습니다" }, { status: 404 });
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      memberUser.id,
      { password: newPassword.trim() }
    );
    if (updateErr) {
      return NextResponse.json({ error: "비밀번호 변경 실패: " + updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "서버 오류: " + String(e) }, { status: 500 });
  }
}
