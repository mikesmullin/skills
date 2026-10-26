#!/usr/bin/env bun
// CLI front end for the skills core. All resolution/rendering lives in
// lib/core.js (shared with mcp-skills); this file only maps argv/exit codes.
import {
  detectTerminalColumns,
  helpText,
  loadConfig,
  listOutput,
  skillFileOutput,
} from "../lib/core.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const list = async () => console.log(await listOutput(config, detectTerminalColumns()));

  if (!command) {
    await list();
    return;
  }

  if (command === "--help") {
    console.log(helpText());
    return;
  }

  if (command === "available") {
    await list();
    return;
  }

  let out = await skillFileOutput(config, command);
  if (out.startsWith("Unknown skill:") || out.startsWith("Failed to read skill file")) {
    console.error(out);
    process.exitCode = 1;
    return;
  }

  // "executing: cat ..." blocks already end with exactly one newline
  // (same as the old process.stdout.write path). Everything else is a
  // line-based listing, so add one.
  if (!out.startsWith("executing: cat")) {
    out += "\n";
  }
  process.stdout.write(out);
}

await main();
