const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { checkForUpdate, isNewerVersion } = require("../dist-electron/main/update-checker.js");

test("同じ版と古い版は更新にしない", () => {
  assert.equal(isNewerVersion("v0.1.4", "0.1.4"), false);
  assert.equal(isNewerVersion("v0.1.3", "0.1.4"), false);
  assert.equal(isNewerVersion("v0.2.0", "0.1.4"), true);
});

test("安定版の新しい Release だけを返す", async () => {
  const cacheDirectory = await mkdtemp(path.join(tmpdir(), "update-check-"));
  const result = await checkForUpdate({
    currentVersion: "0.1.4", cacheDirectory, repository: "owner/repo",
    fetchImpl: async () => new Response(JSON.stringify({ tag_name: "v0.2.0", html_url: "https://github.com/owner/repo/releases/tag/v0.2.0", draft: false, prerelease: false }), { status: 200 })
  });
  assert.deepEqual(result, { currentVersion: "0.1.4", latestVersion: "0.2.0", releaseUrl: "https://github.com/owner/repo/releases/tag/v0.2.0" });
});

for (const field of ["draft", "prerelease"]) {
  test(`${field} Release は除外する`, async () => {
    const cacheDirectory = await mkdtemp(path.join(tmpdir(), "update-check-"));
    const result = await checkForUpdate({
      currentVersion: "0.1.4", cacheDirectory, repository: "owner/repo",
      fetchImpl: async () => new Response(JSON.stringify({ tag_name: "v9.0.0", html_url: "https://github.com/owner/repo/releases/tag/v9.0.0", [field]: true }), { status: 200 })
    });
    assert.equal(result, null);
  });
}

test("通信失敗は例外にせず通知をスキップする", async () => {
  const cacheDirectory = await mkdtemp(path.join(tmpdir(), "update-check-"));
  const result = await checkForUpdate({ currentVersion: "0.1.4", cacheDirectory, repository: "owner/repo", fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(result, null);
});

test("有効なキャッシュがあれば API にアクセスしない", async () => {
  const cacheDirectory = await mkdtemp(path.join(tmpdir(), "update-check-"));
  await writeFile(path.join(cacheDirectory, "update-check.json"), JSON.stringify({ checkedAt: 1000, release: { tag_name: "v0.2.0", html_url: "https://github.com/owner/repo/releases/tag/v0.2.0", draft: false, prerelease: false } }));
  let called = false;
  const result = await checkForUpdate({ currentVersion: "0.1.4", cacheDirectory, repository: "owner/repo", now: () => 1001, fetchImpl: async () => { called = true; throw new Error(); } });
  assert.equal(result?.latestVersion, "0.2.0");
  assert.equal(called, false);
});
