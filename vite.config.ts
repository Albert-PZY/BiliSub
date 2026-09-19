import { fileURLToPath, URL } from "node:url"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "")
  const apiBaseUrl = normalizeBaseUrl(env.VITE_API_BASE_URL) || "http://localhost:3001"
  const apiProxy = {
    "/api": {
      target: apiBaseUrl,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react()],
    base: normalizeBasePath(env.VITE_BASE_PATH),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      proxy: apiProxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      proxy: apiProxy,
    },
    build: {
      target: "es2020",
      sourcemap: false,
    },
  }
})

function normalizeBaseUrl(value?: string): string {
  return value?.trim().replace(/\/+$/, "") ?? ""
}

function normalizeBasePath(value?: string): string {
  const path = value?.trim() || "/"
  if (path === "/") return "/"
  return `/${path.replace(/^\/+|\/+$/g, "")}/`
}
