import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateInBodyValues, type InBodyValues } from "@/lib/inbody";

/**
 * 회원이 "사진으로 기록하기"로 스스로 체성분 기록을 저장하는 전용 경로.
 * body_measurements는 RLS상 트레이너만 쓰기가 가능하므로(rls-policies.sql,
 * "트레이너가 입력, 회원은 조회만"), 이 route는 service role로 RLS를 우회하되
 * - 호출자가 실제로 로그인된 "본인"인지 토큰으로 검증
 * - member_id는 클라이언트 입력을 신뢰하지 않고 호출자 프로필에서 직접 조회
 * - 값 범위를 서버에서도 한 번 더 검증
 * 하는 안전장치를 둬서 "본인 member_id에 대해서만" 저장되게 한다.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "인증 정보가 없습니다" }, { status: 401 });
    }

    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerAuth.user) {
      return NextResponse.json({ error: "인증에 실패했습니다" }, { status: 401 });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("users")
      .select("role, member_id")
      .eq("id", callerAuth.user.id)
      .maybeSingle();

    if (callerProfile?.role !== "member" || !callerProfile.member_id) {
      return NextResponse.json({ error: "회원 계정만 본인 기록을 저장할 수 있습니다" }, { status: 403 });
    }

    const body = (await req.json()) as InBodyValues;

    const issues = validateInBodyValues(body);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues.map((i) => i.message).join(" / ") }, { status: 400 });
    }

    const hasAnyValue =
      body.weight_kg != null ||
      body.skeletal_muscle_kg != null ||
      body.body_fat_kg != null ||
      body.body_fat_pct != null ||
      body.whr != null ||
      body.bmr_kcal != null;
    if (!hasAnyValue) {
      return NextResponse.json({ error: "최소 한 개 이상의 수치를 입력해 주세요" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("body_measurements")
      .insert({
        member_id: callerProfile.member_id,
        measured_at: body.measured_at || new Date().toISOString().slice(0, 10),
        weight_kg: body.weight_kg,
        skeletal_muscle_kg: body.skeletal_muscle_kg,
        body_fat_kg: body.body_fat_kg,
        body_fat_pct: body.body_fat_pct,
        whr: body.whr,
        bmr_kcal: body.bmr_kcal,
        note: "회원이 사진으로 직접 기록",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "저장 실패: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ measurement: data });
  } catch (e) {
    return NextResponse.json({ error: "서버 오류: " + String(e) }, { status: 500 });
  }
}
