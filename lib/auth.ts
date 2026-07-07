"use client";

import { supabase } from "./supabase";
import type { User } from "./types";

const SESSION_KEY = "pt_user_session";

export async function login(
  username: string,
  password: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .maybeSingle();

  if (error || !data) return null;

  // Auto-save session
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  return data as User;
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
