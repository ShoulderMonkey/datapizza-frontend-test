import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({ baseDirectory: __dirname });

// P1-01: `fetch` is allowed only in the API layer (src/api/**), see docs/adr/0002-struttura-per-feature.md.
const FETCH_MESSAGE =
  "Usa il client di src/api/ (request/requestRaw/requestStream o i servizi): fetch è ammesso solo in src/api/**.";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "no-restricted-globals": ["error", { name: "fetch", message: FETCH_MESSAGE }],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: FETCH_MESSAGE },
        { object: "globalThis", property: "fetch", message: FETCH_MESSAGE },
        { object: "self", property: "fetch", message: FETCH_MESSAGE },
      ],
    },
  },
  {
    // The API layer, tests and mocks use fetch legitimately.
    files: [
      "src/api/**",
      "tests/**",
      "e2e/**",
      "src/mocks/**",
      "src/test/**",
      "**/*.test.*",
      "**/*.spec.*",
      "vitest.setup.*",
      "playwright.config.*",
    ],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
    },
  },
];

export default eslintConfig;
