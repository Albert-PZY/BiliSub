// @vitest-environment node

import { describe, expect, it } from "vitest";
import manifest from "../src/manifest";

describe("manifest", () => {
  it("uses mv3 and approved host permissions", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "downloads", "tabs", "sidePanel"]),
    );
    expect(manifest.host_permissions).toEqual([
      "https://*.bilibili.com/*",
      "https://api.openai.com/*",
      "https://dashscope.aliyuncs.com/*",
    ]);
    expect(manifest.host_permissions).not.toContain("<all_urls>");
    expect(manifest.host_permissions).not.toContain("http://127.0.0.1/*");
    expect(manifest.icons).toEqual({
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    });
    expect(manifest.action?.default_icon).toEqual({
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
    });
  });
});
