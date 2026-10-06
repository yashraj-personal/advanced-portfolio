import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// On GitHub Actions the repo name is read automatically, so the site works
// at https://USERNAME.github.io/<repo-name>/ whatever the repo is called
// (e.g. "mac-os"). Locally (npm run dev / build) it uses "/".
// A repo named USERNAME.github.io is served from the root, so it also gets "/".
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = repo && !repo.endsWith(".github.io") ? `/${repo}/` : "/";

export default defineConfig({
  base,
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
