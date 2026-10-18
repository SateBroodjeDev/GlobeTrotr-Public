import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode, command }) => {
  const loaded = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(Object.entries(loaded).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]));
  return {
    define,
    resolve: { alias: { "@": `${process.cwd()}/src` }, dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"] },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({ server: { entry: "server" }, importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } } }),
      ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
      react(),
    ],
  };
});
