import { access, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("built extension manifest exists", async () => {
  const rawManifest = await readFile(new URL("../../dist/manifest.json", import.meta.url), "utf-8");
  const manifest = JSON.parse(rawManifest) as {
    manifest_version?: number;
    host_permissions?: string[];
    icons?: Record<string, string>;
  };

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.host_permissions).toContain("https://*.bilibili.com/*");
  expect(manifest.host_permissions).toContain("https://api.openai.com/*");
  expect(manifest.host_permissions).toContain("https://dashscope.aliyuncs.com/*");
  expect(manifest.icons?.["128"]).toBe("icons/icon128.png");

  await access(new URL("../../dist/icons/icon16.png", import.meta.url));
  await access(new URL("../../dist/icons/icon32.png", import.meta.url));
  await access(new URL("../../dist/icons/icon48.png", import.meta.url));
  await access(new URL("../../dist/icons/icon128.png", import.meta.url));
});
