import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { buildPayload, clean } from "./payload.ts";
import { renderStatusline } from "./renderer.ts";

export default function (pi: ExtensionAPI) {
  let enabled = true;
  let themeName = process.env.CCOMETIXLINE_THEME;
  let context: ExtensionContext | undefined;
  let refresh: (() => void) | undefined;
  let dispose: (() => void) | undefined;

  function install(ctx: ExtensionContext) {
    context = ctx;
    dispose?.();
    dispose = undefined;
    if (!ctx.hasUI || (ctx.mode !== undefined && ctx.mode !== "tui")) return;
    if (!enabled) { ctx.ui.setFooter(undefined); return; }
    const localBinary = fileURLToPath(new URL(`../target/release/ccometixline${process.platform === "win32" ? ".exe" : ""}`, import.meta.url));
    const binary = process.env.CCOMETIXLINE_BIN || (existsSync(localBinary) ? localBinary : "ccometixline");
    ctx.ui.setFooter((tui, theme, footerData) => {
      let line = "";
      let error: string | undefined;
      let stopped = false;
      let busy = false;
      let dirty = false;
      let debounce: ReturnType<typeof setTimeout> | undefined;
      let controller: AbortController | undefined;
      const update = async () => {
        if (stopped) return;
        if (busy) { dirty = true; return; }
        busy = true;
        controller = new AbortController();
        try {
          const result = await renderStatusline(binary, themeName ? ["--theme", themeName] : [], buildPayload(context ?? ctx), controller.signal);
          if (!stopped) { line = result; error = undefined; }
        } catch (err) {
          if (!stopped) { error = String(err); line = ""; }
        } finally {
          busy = false;
          if (!stopped) {
            tui.requestRender();
            if (dirty) { dirty = false; void update(); }
          }
        }
      };
      const schedule = () => {
        if (stopped) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => void update(), 120);
      };
      refresh = schedule;
      const unsubscribe = footerData.onBranchChange(schedule);
      const interval = setInterval(schedule, 5000);
      interval.unref();
      const cleanup = () => {
        if (stopped) return;
        stopped = true;
        clearTimeout(debounce);
        clearInterval(interval);
        controller?.abort();
        unsubscribe();
        if (refresh === schedule) refresh = undefined;
      };
      dispose = cleanup;
      void update();
      return {
        dispose: cleanup,
        invalidate() {},
        render(width: number) {
          const fallback = `${clean((context ?? ctx).model?.name ?? "Pi")} · ${error ? "ccline unavailable — /ccline doctor" : "loading…"}`;
          const lines = [(line || theme.fg("dim", fallback)).split(/\r?\n/)[0]];
          const statuses = [...footerData.getExtensionStatuses().values()].join("  ");
          if (statuses) lines.push(statuses);
          return lines.map((value) => truncateToWidth(value, width));
        },
      };
    });
  }

  pi.on("session_start", async (_event, ctx) => install(ctx));
  const onUpdate = async (_event: unknown, ctx: ExtensionContext) => { context = ctx; refresh?.(); };
  pi.on("session_info_changed", onUpdate);
  pi.on("session_tree", onUpdate);
  pi.on("session_compact", onUpdate);
  pi.on("model_select", onUpdate);
  pi.on("agent_end", onUpdate);
  pi.on("message_end", onUpdate);
  pi.on("tool_execution_end", onUpdate);
  pi.on("session_shutdown", async () => { dispose?.(); });
  pi.registerCommand("ccline", {
    description: "CCometixLine: on, off, theme <name>, doctor",
    handler: async (args, ctx) => {
      const [command, value] = args.trim().split(/\s+/);
      if (command === "doctor") {
        ctx.ui.notify(`Renderer: ${process.env.CCOMETIXLINE_BIN || "local target/release/ccometixline, then ccometixline on PATH"}. Install with: cargo install --git https://github.com/xbunax/CCometixLineForPi --locked. Theme: ${themeName || "config/default"}.`, "info");
      } else if (command === "theme" && value) {
        const themes = ["default", "cometix", "minimal", "gruvbox", "nord", "powerline-dark", "powerline-light", "powerline-rose-pine", "powerline-tokyo-night"];
        if (!themes.includes(value)) { ctx.ui.notify(`Themes: ${themes.join(", ")}`, "warning"); return; }
        themeName = value;
        context = ctx;
        refresh?.();
      } else if (["on", "off", ""].includes(command)) {
        enabled = command === "" ? !enabled : command === "on";
        install(ctx);
      } else ctx.ui.notify("Usage: /ccline [on|off|theme <name>|doctor]", "info");
    },
  });
}
