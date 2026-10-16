/** Pure adapter: use the active Pi branch, never parse Claude transcripts. */
export interface Snapshot {
  cwd: string;
  model?: { id: string; name: string; contextWindow: number };
  getContextUsage(): { tokens: number | null; contextWindow: number } | undefined;
  sessionManager: {
    getSessionFile(): string | undefined;
    getBranch(): Array<{
      type: string;
      timestamp: string;
      message?: { role: string; usage?: { cost: { total: number } } };
    }>;
  };
}

// External strings must not inject terminal control sequences into the footer.
export function clean(text: string): string {
  return text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}

export function buildPayload(ctx: Snapshot, now = Date.now()) {
  const entries = ctx.sessionManager.getBranch();
  let cost = 0;
  for (const entry of entries) {
    if (entry.type === "message" && entry.message?.role === "assistant") {
      const value = entry.message.usage?.cost.total;
      if (value !== undefined && Number.isFinite(value) && value >= 0) cost += value;
    }
  }
  const started = entries.length ? Date.parse(entries[0].timestamp) : now;
  const usage = ctx.getContextUsage();
  return {
    pi: true,
    model: { id: clean(ctx.model?.id ?? "no-model"), display_name: clean(ctx.model?.name ?? "No model") },
    workspace: { current_dir: ctx.cwd },
    transcript_path: ctx.sessionManager.getSessionFile() ?? "",
    context_window: {
      tokens: usage?.tokens ?? null,
      context_window: usage?.contextWindow ?? ctx.model?.contextWindow ?? 0,
    },
    cost: {
      total_cost_usd: cost,
      total_duration_ms: Number.isFinite(started) ? Math.max(0, now - started) : 0,
    },
  };
}
