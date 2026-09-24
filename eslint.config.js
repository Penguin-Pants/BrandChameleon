import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "web-ext-artifacts/", "test-results/", "playwright-report/"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use textContent or DOM builders (FR-51)." },
        { property: "outerHTML", message: "Use textContent or DOM builders (FR-51)." },
        { property: "insertAdjacentHTML", message: "Use DOM builders (FR-51)." },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
