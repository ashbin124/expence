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
];
