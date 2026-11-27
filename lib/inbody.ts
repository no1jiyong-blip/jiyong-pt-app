/** 인바디 사진 인식 결과(및 수동 입력)가 공통으로 쓰는 7개 필드 — body_measurements 쓰기 가능 컬럼과 1:1 대응 */
export interface InBodyValues {
  measured_at: string | null;
  weight_kg: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_kg: number | null;
  body_fat_pct: number | null;
  whr: number | null;
  bmr_kcal: number | null;
}

export const INBODY_FIELDS: { key: keyof Omit<InBodyValues, "measured_at">; label: string; unit: string }[] = [
  { key: "weight_kg", label: "체중", unit: "kg" },
  { key: "skeletal_muscle_kg", label: "골격근량", unit: "kg" },
  { key: "body_fat_kg", label: "체지방량", unit: "kg" },
  { key: "body_fat_pct", label: "체지방률", unit: "%" },
  { key: "whr", label: "복부지방률 WHR", unit: "" },
  { key: "bmr_kcal", label: "기초대사량 BMR", unit: "kcal" },
];

/** 사람 체성분 측정값으로 상식적인 범위 — 이 범위를 벗어나면 사진 오인식일 확률이 높아 경고 */
export const INBODY_RANGES: Record<keyof Omit<InBodyValues, "measured_at">, [number, number]> = {
  weight_kg: [20, 300],
  skeletal_muscle_kg: [5, 80],
  body_fat_kg: [1, 100],
  body_fat_pct: [3, 60],
  whr: [0.5, 1.3],
  bmr_kcal: [500, 4000],
};

/** 범위를 벗어난 값이 있으면 { field, message } 배열로 반환 (빈 배열이면 전부 정상) */
export function validateInBodyValues(values: InBodyValues) {
  const issues: { field: keyof Omit<InBodyValues, "measured_at">; message: string }[] = [];
  for (const { key, label, unit } of INBODY_FIELDS) {
    const v = values[key];
    if (v == null) continue;
    const [min, max] = INBODY_RANGES[key];
    if (v < min || v > max) {
      issues.push({
        field: key,
        message: `${label} 값(${v}${unit})이 일반적인 범위(${min}~${max}${unit})를 벗어났습니다. 다시 확인해 주세요.`,
      });
    }
  }
  return issues;
}
