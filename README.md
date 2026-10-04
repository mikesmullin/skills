# Skills

`skills` is a small CLI that maps tool names to `SKILL.md` files and prints the file you ask for.

## Requirements

- [Bun](https://bun.sh)

## Install

From this project directory:

```bash
bun link
```

Then use globally as:

```bash
skills
```

## First Run Behavior

On startup, `skills` loads every YAML file in:

- `~/.config/skills/*.yaml`

If `config.yaml` does not exist, it is created by copying:

- `config.yaml.example`

## Config Format

Each config file can contain a top-level `skills:` map, a top-level `paths:` list, or both.

```yaml
skills:
  browser: ~/workspace/cli/browser/SKILL.md
  jira: ~/workspace/cli/jira/SKILL.md
  openrgb: ~/workspace/cli/openrgb/SKILL.md

paths:
  - ~/workspace/agent/plugins/*/skills/*.md
  - ~/workspace/agent/plugins/**/.github/prompts/include/*.md
```

- Keys are the names you pass to the CLI (for example, `skills jira`).
- Values are paths to `SKILL.md` files; leading `~/` is expanded to `$HOME`.
- `paths` can contain glob paths; leading `~/` is expanded to `$HOME`. Their matching files are shown in the `AVAILABLE SKILL FILES` section after named CLI tools.
- All files found through `paths` are treated equally; file names and YAML-frontmatter `description:` values are displayed regardless of whether they are governance, correlation, or conventional skill files.
- Use spaces for indentation (not tabs).

## Usage

```text
skills                 List all available skills
skills available       List all available skills
skills <skill>         Print the skill file contents
skills --help          Show help
```

When a skill is printed, a `executing: cat /path/to/SKILL.md` line is emitted, followed by a blank line and then the file contents, so callers know exactly where the skill came from.

## Examples

```bash
skills
skills jira
skills browser
```

## Notes

- `skills` prints available CLI tools in aligned columns, followed by available skill files.
- A pattern matching exactly one discovered skill file prints that file's contents; multiple matches are listed with descriptions.
- Unknown skill names return a non-zero exit code.
