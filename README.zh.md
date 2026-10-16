# CCometixLine for Pi

将 [Haleclipse/CCometixLine](https://github.com/Haleclipse/CCometixLine) 的 Rust 状态栏、九套主题和 TUI 配置器迁移到 **Pi Agent**。通过原生 `ctx.ui.setFooter()` 接管底部栏，无需修改 Pi 源码。

## 安装

适配当前 `@earendil-works/pi-coding-agent`（开发依赖固定为 1.3.0）。Node.js ≥22.19，源码安装渲染器需要 Rust stable、C 编译工具链；Git 信息需要 git。

```bash
# 1. 安装 Rust 渲染器（安装后确认 ~/.cargo/bin 在 PATH 中）
cargo install --git https://github.com/xbunax/CCometixLineForPi --locked

# 2. 安装 Pi 扩展
pi install git:github.com/xbunax/CCometixLineForPi
```

重启 Pi，或在现有会话中执行 `/reload`。扩展自动启用。也可以本地开发：

```bash
git clone https://github.com/xbunax/CCometixLineForPi.git
cd CCometixLineForPi
cargo build --release --locked
pi -e ./extensions/index.ts
```

本地优先使用 `target/release/ccometixline`，否则查找 PATH 中的 `ccometixline`。不使用上游的 `@cometix/ccline` 二进制包，旧版二进制不能正确处理 Pi 数据。

## 使用

- `/ccline off` / `/ccline on`：恢复默认底栏 / 启用本扩展。
- `/ccline theme powerline-tokyo-night`：切换主题，当前进程生效。
- `/ccline doctor`：查看渲染器安装提示。
- `ccometixline --config`：在 **Pi 外的终端** 中打开 Rust TUI 配置器。

可用主题：`default`、`cometix`、`minimal`、`gruvbox`、`nord`、`powerline-dark`、`powerline-light`、`powerline-rose-pine`、`powerline-tokyo-night`。Powerline 主题建议配置 Nerd Font。

```bash
export CCOMETIXLINE_BIN="$HOME/.cargo/bin/ccometixline"
export CCOMETIXLINE_THEME="powerline-tokyo-night"
```

`CCOMETIXLINE_BIN` 是可执行文件路径，不是 shell 命令。配置、模型别名和主题保存在 `~/.pi/agent/ccline/`；设置 `PI_CODING_AGENT_DIR` 时使用 `$PI_CODING_AGENT_DIR/ccline/`。未设置主题环境变量或命令覆盖时，使用配置文件；覆盖主题会使用对应主题文件的分段设置。

## 数据与兼容性

| 分段 | Pi 数据来源 / 行为 |
| --- | --- |
| 模型 | 当前模型 ID / 名称，支持非 Claude 模型 |
| 目录 / Git | 当前工作目录，沿用 Rust 的分支、脏状态、ahead/behind 检查 |
| 上下文 | `ctx.getContextUsage()` 和当前模型窗口，不猜测固定 200k；压缩后未知时显示 `-` |
| 费用 | 当前活动分支上的 assistant 消息 `usage.cost.total`，是模型估算价格，不是订阅账单 |
| 时长 | 当前分支首条记录至当前时间的墙钟时长，含空闲时间 |
| 其他扩展状态 | 保留 `ctx.ui.setStatus()` 内容，显示在第二行 |
| Claude 配额 / 输出风格 / 上游更新 | Pi 模式禁用，不读取 Claude 凭据或查询上游 npm 版本 |

费用和时长沿用原主题的启用设置，部分主题默认关闭；可在配置器中开启。不伪造 Pi 没有提供的修改行数。

状态栏在消息结束、工具结束、模型切换、压缩和会话导航时刷新；空闲时每 5 秒刷新。渲染在异步子进程中进行，合并密集刷新；2.5 秒超时，卸载时终止正在执行的渲染。窄终端按可见字符宽度截断。渲染器缺失/失败时显示诊断入口，Pi 仍可交互。

这是 TUI 扩展；RPC、JSON、print 模式不安装底栏。多个扩展同时调用 `setFooter()` 时，后设置者生效；可用 `/ccline off` 释放。本次针对 `@earendil-works` 包名，不承诺兼容历史 `@mariozechner` 版本。

## 开发验证

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
cargo test --locked
cargo fmt -- --check
cargo clippy --locked -- -D warnings
```

继承的上游 npm 发布工作流已在本 fork 禁用，避免发布到原项目命名空间。原始说明保存在 `docs/upstream/`，仅用于追溯；其中 Claude 安装和 npm 发布步骤不适用于本项目。
