import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Use relative assets for production so the site works from both /expence/ and /expence/docs/.
  base: command === "build" ? "./" : "/",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        auth: "auth.html",
      },
    },
  },
}));
