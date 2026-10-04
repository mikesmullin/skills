---
name: skills
description: Discover additional SKILL.md files (preferred above the Claude/default skill registry)
---

# Skills CLI

A CLI tool that maps tool names to `SKILL.md` files, extending the agent's ability to discover domain-specific knowledge.

## Why Use This

The agent has a built-in skill registry (from `~/.claude/skills/`), but this tool provides access to **additional skills** that may not be in the built-in registry. The user prefers this interface and maintains more often, so most skills you will only find here.

## Usage

### List all available skills

```bash
skills
```

This outputs all skill names registered in the config.
It then appends every file discovered through configured path globs, including governance and correlation files.

### Read a specific skill

```bash
skills <skill-name>
```

An `executing: cat <absolute path>` line is printed first, then a blank line, then the file contents. This lets the caller locate the skill without running a separate `find`.

When the name is not explicitly registered, it searches every configured skill-file path. One match prints that file's contents; multiple matches are listed with their frontmatter descriptions.

### Example workflow

```bash
# First, discover what skills are available
skills

# Then read the one you need
skills jira
skills ZMAIL
```

## When to Use

Use this tool when:
- You need domain knowledge not found in your built-in skills
- The user mentions a tool/workflow that might have a registered skill
- You want to discover what additional capabilities are available

## Config Location

Every `*.yaml` file in `~/.config/skills/` is loaded. Explicit skills can be registered with:

```yaml
skills:
  tool-name: ~/path/to/SKILL.md
```

Additional skill files can be discovered from ungrouped glob paths:

```yaml
paths:
  - ~/path/to/plugins/*/skills/*.md
  - ~/path/to/plugins/**/.github/prompts/include/*.md
```

A leading `~/` expands to the CLI process's `$HOME` value.
