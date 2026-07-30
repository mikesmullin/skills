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
  await ensureConfigFile();
  const configEntries = await fs.readdir(CONFIG_DIR, { withFileTypes: true });
  const configFiles = configEntries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(CONFIG_DIR, entry.name))
    .sort();
  const config = { skills: {}, paths: [] };

  for (const configFilePath of configFiles) {
    const rawConfig = await fs.readFile(configFilePath, "utf8");
    const parsed = parseSkillsConfig(rawConfig, configFilePath);
    Object.assign(config.skills, parsed.skills);
    config.paths.push(...parsed.paths);
  }

  return config;
}

function parseSkillsConfig(rawConfig, configFilePath) {
  const config = { skills: {}, paths: [] };
  const lines = rawConfig.split(/\r?\n/);
  let currentSection = null;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (line.startsWith("\t")) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: use spaces for indentation, not tabs.`);
    }

    if (!line.startsWith(" ")) {
      if (trimmed === "skills:" || trimmed === "paths:") {
        currentSection = trimmed.slice(0, -1);
        continue;
      }
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: expected top-level 'skills:' or 'paths:' key.`);
    }

    if (!currentSection) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: expected a top-level section before this entry.`);
    }

    if (currentSection === "paths") {
      const pathMatch = line.match(/^\s{2,}-\s+(.+?)\s*$/);
      if (!pathMatch) {
        throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: expected '  - <glob-path>'.`);
      }
      config.paths.push(expandHomeDirectory(unquote(pathMatch[1].trim())));
      continue;
    }

    const entryMatch = line.match(/^\s{2,}([^:#]+):\s*(.*?)\s*$/);
    if (!entryMatch) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: expected '  <skill>: <path>'.`);
    }

    const skillName = entryMatch[1].trim();
    const skillPath = expandHomeDirectory(unquote(entryMatch[2].trim()));

    if (!skillName) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: skill name cannot be empty.`);
    }

    if (!skillPath) {
      throw new Error(`Invalid config at ${configFilePath}:${lineNumber}: skill path cannot be empty.`);
    }

    config.skills[skillName] = skillPath;
  }

  if (!currentSection) {
    throw new Error(`Invalid config at ${configFilePath}: expected a top-level 'skills:' or 'paths:' key.`);
  }

  return config;
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function expandHomeDirectory(value) {
  if (value === "~") {
    return process.env.HOME ?? os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(process.env.HOME ?? os.homedir(), value.slice(2));
  }
  return value;
}

function getHelpText() {
  return [
    "Skills: find AI-compatible tools installed w/ SKILL.md files",
    "",
    "Usage:",
    "  skills                 List all available skills",
    "  skills available       List all available skills",
    "  skills <skill>         Print the skill file contents",
    "  skills --help          Show this help"
  ].join("\n");
}

function printAvailableSkills(config) {
  const skills = Object.keys(config.skills).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  console.log("AVAILABLE CLI TOOLS:");
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

async function getFrontmatterDescription(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  if (!content.startsWith("---")) {
    return null;
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return null;
  }

  const block = content.slice(3, end);
  const descriptionLine = block.split(/\r?\n/).find((line) => /^description:\s*(.+)$/.test(line));
  return descriptionLine ? descriptionLine.replace(/^description:\s*/, "").trim() : null;
}

async function findSkillFiles(config, searchPattern) {
  const files = new Set();

  for (const pattern of config.paths) {
    const root = path.parse(pattern).root;
    const globPattern = root ? path.relative(root, pattern) : pattern;
    const cwd = root || process.cwd();
    for await (const file of new Bun.Glob(globPattern).scan({ cwd, onlyFiles: true, dot: true })) {
      if (!searchPattern || file.toLowerCase().includes(searchPattern.toLowerCase())) {
        files.add(path.resolve(cwd, file));
      }
    }
  }

  return [...files].sort();
}

async function printDiscoveredSkillFiles(config, searchPattern, indent = "") {
  const files = await findSkillFiles(config, searchPattern);
  for (const file of files) {
    const description = await getFrontmatterDescription(file);
    console.log(`${indent}${path.relative(process.cwd(), file)}: ${description ?? "(no description)"}`);
  }
  return files.length > 0;
}

async function printAllAvailableSkills(config) {
  printAvailableSkills(config);
  console.log("");
  console.log("AVAILABLE SKILL FILES:");
  console.log("");
  const foundFiles = await printDiscoveredSkillFiles(config, undefined, "    ");
  if (!foundFiles) {
    console.log("    (none)");
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

function soundex(str) {
  const upper = str.toUpperCase().replace(/[^A-Z]/g, "");
  if (!upper) return "";
  const table = { B:1, F:1, P:1, V:1, C:2, G:2, J:2, K:2, Q:2, S:2, X:2, Z:2, D:3, T:3, L:4, M:5, N:5, R:6 };
  let result = upper[0];
  let prev = table[upper[0]] ?? 0;
  for (let i = 1; i < upper.length && result.length < 4; i += 1) {
    const digit = table[upper[i]] ?? 0;
    if (digit !== 0 && digit !== prev) {
      result += digit;
    }
    if (upper[i] !== "H" && upper[i] !== "W") {
      prev = digit;
    }
  }
  return result.padEnd(4, "0");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0).map((__, j) => (j === 0 ? i : 0)));
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function findSimilarSkills(query, skillNames) {
  const lower = query.toLowerCase();
  const suggestions = new Set();

  for (const name of skillNames) {
    const lname = name.toLowerCase();
    if (lname.includes(lower) || lower.includes(lname)) {
      suggestions.add(name);
    }
  }

  const threshold = Math.max(1, Math.floor(lower.length / 3));
  for (const name of skillNames) {
    if (suggestions.has(name)) continue;
    if (levenshtein(lower, name.toLowerCase()) <= threshold) {
      suggestions.add(name);
    }
  }

  // Soundex fallback: only runs when the first two strategies find nothing.
  // Splits hyphenated names into components so "slak" matches "slack-chat" via S420.
  if (suggestions.size === 0) {
    const querySoundex = soundex(query);
    for (const name of skillNames) {
      if (name.split(/[-_]/).some(part => soundex(part) === querySoundex)) {
        suggestions.add(name);
      }
    }
  }

  return [...suggestions].sort();
}

async function printSkillFile(config, skillName) {
  const skillPath = config.skills[skillName];

  if (!skillPath || typeof skillPath !== "string") {
    const matchingFiles = await findSkillFiles(config, skillName);
    if (matchingFiles.length === 1) {
      await printSkillFileContents(matchingFiles[0], skillName);
      return;
    }
    if (matchingFiles.length > 1) {
      await printDiscoveredSkillFiles(config, skillName);
      return;
    }

    const suggestions = findSimilarSkills(skillName, Object.keys(config.skills));
    if (suggestions.length > 0) {
      console.error(`Unknown skill: '${skillName}'. Did you mean: ${suggestions.join(", ")}?`);
    } else {
      console.error(`Unknown skill: '${skillName}'`);
    }
    process.exitCode = 1;
    return;
  }

  await printSkillFileContents(skillPath, skillName);
}

async function printSkillFileContents(skillPath, skillName) {
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

  if (!command) {
    await printAllAvailableSkills(config);
    return;
  }

  if (command === "--help") {
    console.log(getHelpText());
    return;
  }

  if (command === "available") {
    await printAllAvailableSkills(config);
    return;
  }

  await printSkillFile(config, command);
}

await main();
