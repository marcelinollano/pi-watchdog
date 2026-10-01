# pi-watchdog

A provider-stall watchdog for [Pi](https://github.com/earendil-works/pi). If a model request hangs, for example when Bedrock behind an LLM gateway stops responding, the watchdog aborts the request and restarts the run with a hidden `Continue.` message. Without it you'd have to kill the turn and type "continue" yourself.

> **Credit:** This is a standalone extraction of the `provider-stall-watchdog` extension from
> [**pi-quiver**](https://github.com/jjuraszek/pi-quiver) by **[Jacek Juraszek](https://github.com/jjuraszek)**,
> taken from [v6.8.0](https://github.com/jjuraszek/pi-quiver/blob/v6.8.0/extensions/provider-stall-watchdog.ts) under the MIT License.
> Jacek designed and built the detection logic, the recovery flow and most of the tests.
> This repo packages the watchdog on its own, with a few small changes (see [Differences from upstream](#differences-from-upstream)).
> If you want the full set of Pi extensions, skills and prompts, use [pi-quiver](https://github.com/jjuraszek/pi-quiver).

## What it does

| Stall | Detection | Modes |
|---|---|---|
| No response at all | no first stream event within `firstEventMs` (20s) | all (TUI, RPC, print, JSON) |
| Goes quiet mid-answer | no text, thinking or tool-call delta: warns at `warningMs` (2m), recovers at `recoveryMs` (4m) | TUI only |

When it recovers a stalled request, it:

1. aborts the stalled request.
2. removes the aborted attempt from the model's context. The transcript still shows it.
3. waits out Pi's own retry backoff (`retry.baseDelayMs * 2^(n-1)`, capped by `retry.maxAgentDelayMs`) and shows `Retrying (1/3) in 2s... (Esc to cancel)` in the footer.
4. sends a hidden user message: *"The previous provider request stalled before completing and was retried automatically. Continue."*

You can cancel the retry during the countdown by typing a new prompt, running `/compact` or `/tree`, or pressing Esc. A successful turn resets the retry counter.

**Why it restarts the run itself instead of using Pi's built-in retry:** since Pi 0.86, an abort ends the whole run, so Pi's retry loop never runs after an extension aborts a request. See [docs/how-it-works.md](docs/how-it-works.md).

## Install

From GitHub:

```bash
pi install git:github.com/marcelinollano/pi-watchdog
```

From a local clone:

```bash
git clone https://github.com/marcelinollano/pi-watchdog.git
pi install ./pi-watchdog
# or load it for one session only:
pi -e ./pi-watchdog
```

Pi's `retry.enabled` setting must be `true`, which is the default.

## Configuration

The watchdog is **on by default**. To change its behavior, add a `piWatchdog` key to `~/.pi/agent/settings.json`. You can also add it to a project's `.pi/settings.json`; any field set there overrides the global value.

```jsonc
{
  "piWatchdog": {
    "enabled": true,          // set "piWatchdog": false to turn it off
    "firstEventMs": 20000,    // no-response deadline, every mode
    "warningMs": 120000,      // mid-stream silence warning (TUI)
    "recoveryMs": 240000,     // mid-stream silence abort + retry (TUI); must be > warningMs
    "maxStallRetries": 3,     // defaults to retry.maxRetries; 0 = detect and stop, never retry
    "models": {               // per-model overrides; glob matched against "provider/model-id"; first match wins
      "sf-llm-gateway/*opus*": { "firstEventMs": 60000, "recoveryMs": 300000 }
    }
  }
}
```

- The config is read once per session. Restart Pi or start a new session to apply changes.
- If the config is invalid, the watchdog shows a warning and stays off for that session rather than running with bad settings.
- **Thinking models:** streamed thinking deltas count as progress, so they keep the timer from running out. If your provider or gateway sends nothing while the model is thinking, raise `firstEventMs` and `recoveryMs` for that model under `models`.

## Develop

```bash
npm install
npm run check   # tsc + test suite (unit + real AgentSession integration)
```

To reproduce a stall by hand with a fake provider that hangs, see [docs/how-it-works.md](docs/how-it-works.md#manual-repro-tui).

## Differences from upstream

- **Standalone:** it doesn't depend on pi-quiver. The config module is rewritten (`src/config.ts`).
- **Settings key:** `piWatchdog` at the top level, instead of `quiver.providerStallWatchdog`.
- **On by default:** in upstream you have to turn it on.
- **Names:** the status key and custom message type are renamed to `pi-watchdog`.

The detection and recovery logic is otherwise unchanged from upstream.

## Credits & license

- Original work: [Jacek Juraszek](https://github.com/jjuraszek), the `provider-stall-watchdog` extension in [pi-quiver](https://github.com/jjuraszek/pi-quiver). © 2026 Jacek Juraszek, MIT.
- Extraction and changes: [Marcelino Llano](https://github.com/marcelinollano).

Released under the [MIT License](LICENSE), which keeps the original copyright notice.
