module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-korean-only": (parsed) => {
          const { subject } = parsed;
          if (!subject) return [false, "커밋 메시지(subject)가 비어있습니다."];

          // 정규식: 한글이 최소 1자 이상 포함되어 있는지 검사
          const hasKorean = /[가-힣]/.test(subject);

          return [
            hasKorean,
            "커밋 메시지(내용)에 반드시 한글로 된 설명을 포함시켜야 합니다. (순수 영어 커밋 금지)",
          ];
        },
      },
    },
  ],
  rules: {
    // 우리가 만든 한글 강제 규칙을 항상 에러(2) 수준으로 적용
    "subject-korean-only": [2, "always"],

    // "UI", "DB", "API" 같은 대문자 명사를 자연스럽게 한글과 섞어 쓸 수 있도록
    // 기본으로 켜져있는 까다로운 영어 대소문자 제한 규칙은 끕니다.
    "subject-case": [0, "always"],

    // convention.md 문서와 일치하도록 허용 타입 명시 (design 포함)
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "design", "refactor", "docs", "chore", "test", "style", "perf", "ci", "build", "revert"],
    ],
  },
};
