import test from "node:test";
import assert from "node:assert/strict";
import { renderStatusline } from "../extensions/renderer.ts";
test("passes stdin and arguments without invoking a shell", async () => {
  const output = await renderStatusline(process.execPath, ["-e", 'process.stdin.on("data", d => process.stdout.write(JSON.parse(d).model))'], { model: "$(echo injected); `whoami`" });
  assert.equal(output, "$(echo injected); `whoami`");
});
test("missing binary and nonzero exit reject safely", async () => {
  await assert.rejects(renderStatusline("/missing/ccometixline", [], {}), /ENOENT/);
  await assert.rejects(renderStatusline(process.execPath, ["-e", 'process.stderr.write("bad config"); process.exit(2)'], {}), /bad config/);
});
test("bounds a hanging renderer", async () => {
  await assert.rejects(renderStatusline(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {}), /timed out/);
});
test("disposal aborts an in-flight renderer", async () => {
  const controller = new AbortController();
  const pending = renderStatusline(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, /aborted/);
});
