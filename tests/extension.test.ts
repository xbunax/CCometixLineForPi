import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import extension from "../extensions/index.ts";

test("footer lifecycle: render, narrow widths, branch/model change, toggle and cleanup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-ccline-"));
  const binary = join(dir, "fake-renderer");
  writeFileSync(binary, `#!${process.execPath}\nprocess.stdin.on('data', d => { const p = JSON.parse(d); process.stdout.write(p.model.display_name + ' · 中文😀 · ' + p.cost.total_cost_usd); });\n`, { mode: 0o755 });
  const previous = process.env.CCOMETIXLINE_BIN;
  process.env.CCOMETIXLINE_BIN = binary;
  const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => Promise<void>>();
  let command: { handler: (args: string, ctx: ExtensionContext) => Promise<void> };
  let component: { render(width: number): string[]; dispose(): void } | undefined;
  let unsubscribes = 0;
  let renderCount = 0;
  const api = {
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => Promise<void>) => handlers.set(event, handler),
    registerCommand: (_name: string, definition: typeof command) => { command = definition; },
  };
  const ctx = {
    hasUI: true, mode: "tui", cwd: dir,
    model: { id: "test", name: "Model A", contextWindow: 128000 },
    getContextUsage: () => ({ tokens: 10, contextWindow: 128000 }),
    sessionManager: { getSessionFile: () => undefined, getBranch: () => [] },
    ui: {
      notify() {},
      setFooter(factory: ((...args: any[]) => typeof component) | undefined) {
        component?.dispose();
        component = factory?.({ requestRender: () => renderCount++ }, { fg: (_color: string, value: string) => value }, {
          onBranchChange: () => () => { unsubscribes++; },
          getExtensionStatuses: () => new Map([["other", "other-extension"]]),
        });
      },
    },
  } as unknown as ExtensionContext;
  const until = async (condition: () => boolean) => {
    const end = Date.now() + 5000;
    while (!condition()) {
      if (Date.now() > end) throw new Error("Footer did not update");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  try {
    extension(api as unknown as ExtensionAPI);
    await handlers.get("session_start")!({}, ctx);
    await until(() => !!component?.render(100)[0].includes("Model A · 中文😀 · 0"));
    assert.equal(component!.render(100)[1], "other-extension");
    assert.ok(visibleWidth(component!.render(8)[0]) <= 8);
    const next = { ...ctx, model: { ...ctx.model!, name: "Model B" } };
    await handlers.get("model_select")!({}, next);
    await until(() => !!component?.render(100)[0].includes("Model B · 中文😀 · 0"));
    await command!.handler("off", next);
    assert.equal(component, undefined);
    assert.equal(unsubscribes, 1);
    await command!.handler("on", next);
    await until(() => !!component?.render(100)[0].includes("Model B · 中文😀 · 0"));
    await handlers.get("session_shutdown")!({}, next);
    assert.equal(unsubscribes, 2);
    const afterDispose = renderCount;
    await handlers.get("message_end")!({}, next);
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(renderCount, afterDispose);
    await handlers.get("session_start")!({}, { ...next, mode: "rpc" });
    assert.equal(unsubscribes, 2);
  } finally {
    component?.dispose();
    if (previous === undefined) delete process.env.CCOMETIXLINE_BIN;
    else process.env.CCOMETIXLINE_BIN = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
