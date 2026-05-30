import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(root, "out")
const target = resolve(root, "..", "src", "bili_ai_sub", "web_static")

if (process.env.SKIP_STATIC_SYNC === "true") {
  console.log("Skipped syncing static frontend output")
  process.exit(0)
}

if (!existsSync(source)) {
  throw new Error(`Next export output not found: ${source}`)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true })

console.log(`Synced ${source} -> ${target}`)
