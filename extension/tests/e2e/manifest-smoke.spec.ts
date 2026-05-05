import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("built extension manifest exists", async () => {
  const rawManifest = await readFile(new URL("../../dist/manifest.json", import.meta.url), "utf-8");
  const manifest = JSON.parse(rawManifest) as { manifest_version?: number; host_permissions?: string[] };

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.host_permissions).toContain("https://*.bilibili.com/*");
  expect(manifest.host_permissions).toContain("https://api.openai.com/*");
  expect(manifest.host_permissions).toContain("https://dashscope.aliyuncs.com/*");
});
