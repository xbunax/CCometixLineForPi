import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, clean, type Snapshot } from "../extensions/payload.ts";
const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  cwd: "/tmp/project with spaces",
  model: { id: "gpt-test", name: "GPT Test", contextWindow: 1000000 },
  getContextUsage: () => ({ tokens: 250000, contextWindow: 1000000 }),
  sessionManager: {
    getSessionFile: () => undefined,
    getBranch: () => [
      { type: "message", timestamp: "2026-01-01T00:00:00Z", message: { role: "user" } },
      { type: "message", timestamp: "2026-01-01T00:00:01Z", message: { role: "assistant", usage: { cost: { total: 0.25 } } } },
      { type: "message", timestamp: "2026-01-01T00:00:02Z", message: { role: "assistant", usage: { cost: { total: 0.5 } } } },
    ],
  },
  ...overrides,
});
test("maps Pi model, authoritative context and active branch cost", () => {
  const payload = buildPayload(snapshot(), Date.parse("2026-01-01T00:01:00Z"));
  assert.equal(payload.pi, true);
  assert.equal(payload.cost.total_cost_usd, 0.75);
  assert.equal(payload.cost.total_duration_ms, 60000);
  assert.deepEqual(payload.context_window, { tokens: 250000, context_window: 1000000 });
  assert.equal(payload.workspace.current_dir, "/tmp/project with spaces");
  assert.equal(payload.transcript_path, "");
});
test("preserves unknown context after compaction rather than reporting zero", () => {
  assert.equal(buildPayload(snapshot({ getContextUsage: () => ({ tokens: null, contextWindow: 1000000 }) })).context_window.tokens, null);
});
test("new session without model or messages is supported", () => {
  const payload = buildPayload(snapshot({ model: undefined, getContextUsage: () => undefined, sessionManager: { getBranch: () => [], getSessionFile: () => undefined } }));
  assert.equal(payload.model.id, "no-model");
  assert.equal(payload.cost.total_cost_usd, 0);
  assert.equal(payload.cost.total_duration_ms, 0);
  assert.equal(payload.context_window.tokens, null);
});
test("removes terminal controls from display strings", () => {
  assert.equal(clean("GPT\x1b[31m red\x1b[0m\n"), "GPT red");
  assert.equal(clean("\x1b]0;title\x07safe"), "safe");
});
