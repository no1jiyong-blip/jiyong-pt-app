import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    rules: {
      // "마운트 시 데이터 로드 후 loading 해제" 패턴이 앱 전반에 쓰이는데,
      // 이 규칙은 async 콜백 안의 setState까지 전부 error로 잡아서 실질적인
      // 버그 신호가 아님. 가시성은 유지하되 빌드/린트를 막지 않도록 warn으로 완화.
      "react-hooks/set-state-in-effect": "warn",
      // Date에서 파생된 값들을 React Compiler가 보수적으로 "나중에 바뀔 수도
      // 있다"고 보고 자동 최적화를 포기하는 경우가 있음. 기존 수동 useMemo는
      // 그대로 정상 동작하는 성능 힌트일 뿐이라 error로 빌드/린트를 막지 않음.
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
