# pi-watchdog

Provider-stall watchdog for [Pi](https://github.com/earendil-works/pi). When a model request hangs (e.g. Bedrock through the LLM gateway goes silent), it aborts the request and **automatically re-drives the run with a hidden `Continue.`** — the thing you'd otherwise do by killing the turn and typing "continue".

Extracted from the `provider-stall-watchdog` extension in [pi-quiver](https://github.com/jjuraszek/pi-quiver) v6.8.0 (MIT, © Jacek Juraszek), without the rest of the pack.

## What it does

| Stall | Detection | Modes |
|---|---|---|
| No response at all | no first stream event within `firstEventMs` (20s) | all (TUI, RPC, print, JSON) |
| Goes quiet mid-answer | no text/thinking/tool-call delta: warn at `warningMs` (2m), recover at `recoveryMs` (4m) | TUI only |

On recovery it:

1. aborts the stalled request,
2. drops the aborted attempt from the model's context (the transcript still shows it),
3. waits Pi's own retry backoff (`retry.baseDelayMs * 2^(n-1)`, capped by `retry.maxAgentDelayMs`), showing `Retrying (1/3) in 2s... (Esc to cancel)` in the footer,
4. sends a hidden user message: *"The previous provider request stalled before completing and was retried automatically. Continue."*

Typing a new prompt, `/compact`, `/tree`, or pressing Esc during the countdown cancels the retry. A successful turn resets the retry counter.

Why it re-drives itself instead of relying on Pi's native retry: since Pi 0.86 an abort fences the whole run, so Pi's retry loop never fires after an extension abort. See [docs/how-it-works.md](docs/how-it-works.md).

## Install

```bash
pi install ~/Documents/Code/pi-watchdog
# or try once:
pi -e ~/Documents/Code/pi-watchdog
```

Requires Pi's `retry.enabled` to be `true` (the default).

## Configuration

**Enabled by default.** Optional overrides go under `piWatchdog` in `~/.pi/agent/settings.json` (or project `.pi/settings.json`, which wins per-field):

```jsonc
{
  "piWatchdog": {
    "enabled": true,          // or just `"piWatchdog": false` to turn it off
    "firstEventMs": 20000,    // no-response deadline, every mode
    "warningMs": 120000,      // mid-stream silence warning (TUI)
    "recoveryMs": 240000,     // mid-stream silence abort + retry (TUI); must be > warningMs
    "maxStallRetries": 3,     // defaults to retry.maxRetries; 0 = detect and stop, never retry
    "models": {               // per-model overrides, glob on "provider/model-id", first match wins
      "sf-llm-gateway/*opus*": { "firstEventMs": 60000, "recoveryMs": 300000 }
    }
  }
}
```

Config is read once per session (restart or start a new session to pick up changes). Invalid config disables the watchdog for the session with a warning — it fails closed.

**Thinking models:** "progress" includes thinking deltas, so streamed reasoning keeps the clock alive. If your provider/gateway emits nothing while thinking, raise `firstEventMs` / `recoveryMs` for that model via `models`.

## Develop

```bash
npm install
npm run check   # tsc + 76 tests (unit + real AgentSession integration)
```

Manual repro against a fake stalling provider: see [docs/how-it-works.md](docs/how-it-works.md#manual-repro-tui).

## Differences from upstream

- Standalone: no pi-quiver dependency; config module rewritten (`src/config.ts`).
- Settings key `piWatchdog` (top-level) instead of `quiver.providerStallWatchdog`.
- **On by default** (upstream is opt-in).
- Status key / custom message type renamed to `pi-watchdog`.
