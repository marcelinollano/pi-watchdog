/**
 * Settings resolution for pi-watchdog.
 *
 * Layers, lowest precedence first:
 *   1. global  - `<getAgentDir()>/settings.json`
 *   2. project - `<cwd>/.pi/settings.json`
 *
 * Config lives under the top-level `piWatchdog` key. Each layer's value is
 * coerced into a partial patch and merged over the defaults in layer order,
 * so project fields override matching global fields.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export const SETTINGS_KEY = "piWatchdog";
export const CONFIG_FIELDS = ["enabled", "firstEventMs", "warningMs", "recoveryMs", "maxStallRetries", "models", "retryErrorPatterns"] as const;

export function readSettings(path: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

export function settingsPaths(cwd: string): string[] {
	return [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")];
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

const emittedWarnings = new Set<string>();

function emitWarning(warn: ((message: string) => void) | undefined, message: string): void {
	if (!warn || emittedWarnings.has(message)) return;
	emittedWarnings.add(message);
	warn(message);
}

export function resolveConfig<T extends object>(
	cwd: string,
	defaults: T,
	coerce: (raw: unknown) => Partial<T> | undefined,
	warn?: (message: string) => void,
): T {
	const cfg: T = { ...defaults };
	for (const path of settingsPaths(cwd)) {
		const settings = readSettings(path);
		if (!settings || !Object.hasOwn(settings, SETTINGS_KEY)) continue;
		const raw = settings[SETTINGS_KEY];
		if (isPlainObject(raw)) {
			const unknown = Object.keys(raw).filter((k) => !(CONFIG_FIELDS as readonly string[]).includes(k));
			if (unknown.length > 0) {
				emitWarning(warn, `pi-watchdog (${path}): unknown ${SETTINGS_KEY} keys ${unknown.map((k) => `"${k}"`).join(", ")} ignored; accepted: ${CONFIG_FIELDS.join(", ")}`);
			}
		}
		const patch = coerce(raw);
		if (patch) Object.assign(cfg, patch);
		else emitWarning(warn, `pi-watchdog: "${SETTINGS_KEY}" in ${path} has an unrecognized value; ignored.`);
	}
	return cfg;
}
