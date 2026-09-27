"use client";

import { supabase } from "./supabase";
import type { User } from "./types";

const EMAIL_DOMAIN = "ptcoachpro.internal";

/** username은 실제 이메일이 아니므로, Supabase Auth용 가짜 이메일을 만들어 씀 */
function syntheticEmail(username: string) {
  return `${username}@${EMAIL_DOMAIN}`;
}

export async function login(
  username: string,
  password: string
): Promise<User | null> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail(username.trim()),
    password,
  });

  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return null;
  }

  return profile as User;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error || !profile) return null;
  return profile as User;
}

export async function logout() {
  await supabase.auth.signOut();
}
