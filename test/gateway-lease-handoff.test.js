import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("SIGTERM waits for the gateway to exit so it releases its state lease", () => {
  const idx = src.indexOf('process.on("SIGTERM"');
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 900);
  assert.match(window, /proc\.once\("exit"/);
  assert.match(window, /GATEWAY_STOP_WAIT_MS/);
  assert.doesNotMatch(window, /server\.close\(\(\) => process\.exit\(0\)\)/);

  const wait = src.match(/const GATEWAY_STOP_WAIT_MS = ([\d_]+);/);
  assert.ok(wait);
  // Railway sends SIGKILL 30s after SIGTERM.
  assert.ok(Number(wait[1].replaceAll("_", "")) < 30_000);
});

test("boot keeps retrying the gateway start until an old lease can expire", () => {
  const idx = src.indexOf("async function startGatewayAtBoot");
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 900);
  assert.match(window, /await ensureGatewayRunning\(\)/);
  assert.match(window, /await sleep\(GATEWAY_BOOT_RETRY_MS\)/);
  assert.match(src, /config detected; starting gateway\.\.\."\);\s*await startGatewayAtBoot\(\);/);

  const windowMinutes = src.match(/const GATEWAY_BOOT_RETRY_WINDOW_MS = (\d+) \* 60_000;/);
  assert.ok(windowMinutes);
  // An abandoned lease expires 5 minutes after its last renewal.
  assert.ok(Number(windowMinutes[1]) > 5);
});
