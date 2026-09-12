import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat config directly — no FlatCompat bridge, which
// in any case crashes under ESLint 10.
const eslintConfig = [
    ...coreWebVitals,
    ...typescript,
    {
        ignores: [
            ".next/**",
            "node_modules/**",
            "next-env.d.ts",
            "messages/**",
        ],
    },
];

export default eslintConfig;
