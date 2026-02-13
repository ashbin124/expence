import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist", "docs", "node_modules"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["src/**/*.test.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
    },
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.serviceworker,
      },
    },
  },
];
