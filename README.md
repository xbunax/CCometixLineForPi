# CCometixLine for Pi

A native Pi Agent footer backed by the original Rust renderer, nine themes, and interactive TUI configurator from [Haleclipse/CCometixLine](https://github.com/Haleclipse/CCometixLine).

[中文说明](README.zh.md)

## Install

Requires current `@earendil-works/pi-coding-agent` (typechecked against 1.3.0), Node ≥22.19, and stable Rust with a C toolchain to build the renderer. Git is needed for repository status.

```bash
cargo install --git https://github.com/xbunax/CCometixLineForPi --locked
pi install git:github.com/xbunax/CCometixLineForPi
```

Ensure `~/.cargo/bin` is on PATH. Restart Pi or run `/reload`. Do not install the upstream `@cometix/ccline` binary: it does not support this bridge protocol.

For local development:

```bash
git clone https://github.com/xbunax/CCometixLineForPi.git
cd CCometixLineForPi
cargo build --release --locked
pi -e ./extensions/index.ts
```

The extension uses `CCOMETIXLINE_BIN`, the local `target/release/ccometixline`, or `ccometixline` on PATH, in that order. No binary is downloaded automatically.

## Configure

- `/ccline on`, `/ccline off`: enable or restore Pi's default footer.
- `/ccline theme powerline-tokyo-night`: change the theme for this process.
- `/ccline doctor`: show renderer setup information.
- `ccometixline --config`: run the Rust configurator in a separate terminal outside Pi.

Set `CCOMETIXLINE_THEME` to persist a theme override. `CCOMETIXLINE_BIN` must be an executable path, not a shell command. Configuration lives at `~/.pi/agent/ccline/`, or `$PI_CODING_AGENT_DIR/ccline/` when set. Theme overrides select the corresponding theme file's segment settings. Powerline themes work best with a Nerd Font.

Themes: default, cometix, minimal, gruvbox, nord, powerline-dark, powerline-light, powerline-rose-pine, powerline-tokyo-night.

## Behavior

Pi's extension API supplies the model, context estimate and model window. Unknown context immediately after compaction stays unknown. Cost sums assistant messages on the active session branch; it is a model price estimate, not a subscription bill. Duration is wall time since the first branch entry, including idle time. Cost and duration visibility follows each theme's settings; enable them in the configurator if desired.

Git status and directory rendering remain in Rust. Other extensions' status messages are retained on a second line. Claude quota, output-style and upstream update segments are skipped in Pi mode, without reading Claude credentials. No edit-line totals are invented.

Refreshes are asynchronous and coalesced, triggered by session/model/tool/message events and a five-second heartbeat. Renderer timeout is 2.5 seconds. Shutdown and replacement cancel pending work. Output is clipped to terminal display width, and renderer errors show a diagnostic hint without blocking Pi.

Only terminal UI mode installs a footer. Other footer extensions may replace it; the last `setFooter()` call wins. Historical `@mariozechner` Pi versions are not a supported target.

## Development

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
cargo test --locked
cargo fmt -- --check
cargo clippy --locked -- -D warnings
```

CI checks both the TypeScript bridge and Rust renderer. The inherited upstream release workflow is disabled for this fork to prevent publishing under the upstream npm namespace. Original documentation is preserved in `docs/upstream/` for provenance; its Claude/npm installation steps do not apply here.
