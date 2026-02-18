#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const CONFIG_DIR = path.join(os.homedir(), ".config", "skills");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.yaml");
const EXAMPLE_CONFIG_PATH = new URL("../config.yaml.example", import.meta.url);

async function ensureConfigFile() {
  try {
    await fs.access(CONFIG_PATH);
    return CONFIG_PATH;
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const exampleContent = await fs.readFile(EXAMPLE_CONFIG_PATH, "utf8");
    await fs.writeFile(CONFIG_PATH, exampleContent, "utf8");
    return CONFIG_PATH;
  }
}

async function loadConfig() {
  const configFilePath = await ensureConfigFile();
  const rawConfig = await fs.readFile(configFilePath, "utf8");
  return parseSkillsConfig(rawConfig, configFilePath);
}

function parseSkillsConfig(rawConfig, configFilePath) {
  const skills = {};
  const lines = rawConfig.split(/\r?\n/);
  let foundSkillsKey = false;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (!foundSkillsKey) {
      if (trimmed === "skills:") {
        foundSkillsKey = true;
        continue;
      }
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: expected top-level 'skills:' key.`);
    }

    if (line.startsWith("\t")) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: use spaces for indentation, not tabs.`);
    }

    if (!line.startsWith(" ")) {
      break;
    }

    const entryMatch = line.match(/^\s{2,}([^:#]+):\s*(.*?)\s*$/);
    if (!entryMatch) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: expected '  <skill>: <path>'.`);
    }

    const skillName = entryMatch[1].trim();
    let skillPath = entryMatch[2].trim();

    if (!skillName) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: skill name cannot be empty.`);
    }

    if (!skillPath) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: skill path cannot be empty.`);
    }

    if ((skillPath.startsWith('"') && skillPath.endsWith('"')) || (skillPath.startsWith("'") && skillPath.endsWith("'"))) {
      skillPath = skillPath.slice(1, -1);
    }

    skills[skillName] = skillPath;
  }

  if (!foundSkillsKey) {
    throw new Error(`Invalid config at ${configFilePath}: expected a top-level 'skills:' key.`);
  }

  return skills;
}

function getHelpText() {
  return [
    "Skills: find AI-compatible tools installed w/ SKILL.md files",
    "",
    "Usage:",
    "  skills <skill>         Print the skill file contents",
    "  skills available       List available skills",
    "  skills --help          Show help and list available skills"
  ].join("\n");
}

function printAvailableSkills(config) {
  const skills = Object.keys(config).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  console.log("AVAILABLE SKILLS:");
  console.log("");

  if (skills.length === 0) {
    console.log("(none)");
    return;
  }

  const indent = "    ";
  const gap = 4;
  const terminalWidth = detectTerminalColumns();
  const availableWidth = Math.max(1, terminalWidth - indent.length);

  const calculateColumnWidths = (columnCount) => {
    const rows = Math.ceil(skills.length / columnCount);
    const widths = Array(columnCount).fill(0);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        const index = row * columnCount + column;
        if (index >= skills.length) {
          continue;
        }
        widths[column] = Math.max(widths[column], skills[index].length);
      }
    }

    return widths;
  };

  const calculateRenderedWidth = (widths) => {
    if (widths.length === 0) {
      return 0;
    }
    return widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  };

  let columns = 1;
  let columnWidths = calculateColumnWidths(1);

  for (let candidate = 2; candidate <= skills.length; candidate += 1) {
    const candidateWidths = calculateColumnWidths(candidate);
    const renderedWidth = calculateRenderedWidth(candidateWidths);
    if (renderedWidth <= availableWidth) {
      columns = candidate;
      columnWidths = candidateWidths;
      continue;
    }
    break;
  }

  for (let index = 0; index < skills.length; index += columns) {
    const row = skills.slice(index, index + columns);
    const formattedCells = row.map((skillName, columnIndex) => {
      const isLastCell = columnIndex === row.length - 1;
      if (isLastCell) {
        return skillName;
      }
      return skillName.padEnd(columnWidths[columnIndex] + gap, " ");
    });

    console.log(`${indent}${formattedCells.join("")}`);
  }
}

function detectTerminalColumns() {
  if (process.stdout.columns && Number.isFinite(process.stdout.columns)) {
    return process.stdout.columns;
  }

  try {
    const sttyOutput = execSync("stty size", { encoding: "utf8", stdio: ["inherit", "pipe", "ignore"] }).trim();
    const parts = sttyOutput.split(/\s+/);
    const columns = Number(parts[1]);
    if (Number.isFinite(columns) && columns > 0) {
      return columns;
    }
  } catch {
  }

  try {
    const tputOutput = execSync("tput cols", { encoding: "utf8", stdio: ["inherit", "pipe", "ignore"] }).trim();
    const columns = Number(tputOutput);
    if (Number.isFinite(columns) && columns > 0) {
      return columns;
    }
  } catch {
  }

  return 80;
}

async function printSkillFile(config, skillName) {
  const skillPath = config[skillName];

  if (!skillPath || typeof skillPath !== "string") {
    console.error(`Unknown skill: ${skillName}`);
    process.exitCode = 1;
    return;
  }

  try {
    const content = await fs.readFile(skillPath, "utf8");
    process.stdout.write(content);
    if (!content.endsWith("\n")) {
      process.stdout.write("\n");
    }
  } catch (error) {
    console.error(`Failed to read skill file for '${skillName}' at ${skillPath}: ${error.message}`);
    process.exitCode = 1;
  }
}

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

  if (!command || command === "--help") {
    console.log(getHelpText());
    console.log("");
    printAvailableSkills(config);
    console.log("");
    return;
  }

  if (command === "available") {
    printAvailableSkills(config);
    return;
  }

  await printSkillFile(config, command);
}

await main();
