import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export function formatShortKoreanDate(iso: string): string {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function getWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}

/** 주 시작일(월요일) ISO 날짜를 deltaWeeks 주만큼 앞/뒤로 이동 */
export function shiftWeekStartISO(weekStartISO: string, deltaWeeks: number): string {
  const d = new Date(`${weekStartISO}T00:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

/** 주 시작일(월요일) 기준으로 "MM.DD ~ MM.DD" 범위와 "M월 N주차" 라벨 생성 */
export function formatWeekRange(weekStartISO: string) {
  const monday = new Date(`${weekStartISO}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  const rangeLabel = `${pad(monday.getMonth() + 1)}.${pad(monday.getDate())} ~ ${pad(
    sunday.getMonth() + 1
  )}.${pad(sunday.getDate())}`;
  const monthLabel = `${sunday.getMonth() + 1}월`;
  const weekLabel = `${monthLabel} ${Math.ceil(sunday.getDate() / 7)}주차`;
  return { rangeLabel, weekLabel, monthLabel };
}

/** "[카테고리] 내용" 형식이면 분리, 아니면 전체를 본문으로 취급 */
export function parseHomeworkCategory(content: string): { category: string | null; text: string } {
  const m = content.match(/^\[(.+?)\]\s*(.*)$/);
  return m ? { category: m[1], text: m[2] } : { category: null, text: content };
}

/** 트레이너가 숙제 등록 시 선택할 수 있는 카테고리 (회원 MISSION 탭 배지와 동일) */
export const HOMEWORK_CATEGORIES = ["운동", "식단/영양", "근이완/스트레칭", "생활습관"] as const;

export const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export const DAY_NAME_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/** 짧은 햅틱 진동(지원 안 하는 브라우저/환경에서도 안전) — 그래프 활성 포인트 전환 등 미세 피드백용 */
export function hapticTick(ms: number = 8) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    // 진동 API 미지원 환경 — 무시
  }
}
