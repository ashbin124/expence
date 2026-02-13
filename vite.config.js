import { env } from "node:process";
import { defineConfig } from "vite";

const repoName = env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubActions = env.GITHUB_ACTIONS === "true";
const base = isGitHubActions && repoName ? `/${repoName}/` : "/";

export default defineConfig({
  base,
});
