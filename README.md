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

On startup, `skills` loads:

- `~/.config/skills/config.yaml`

If that file does not exist, it is created by copying:

- `config.yaml.example`

## Config Format

The config must contain a top-level `skills:` map.

```yaml
skills:
  browser: /workspace/cli/browser/SKILL.md
  jira: /workspace/cli/jira/SKILL.md
  openrgb: /workspace/cli/openrgb/SKILL.md
```

- Keys are the names you pass to the CLI (for example, `skills jira`).
- Values are absolute paths to `SKILL.md` files.
- Use spaces for indentation (not tabs).

## Usage

```text
skills <skill>         Print the skill file contents
skills available       List available skills
skills --help          Show help and list available skills
```

## Examples

```bash
skills available
skills jira
skills browser
```

## Notes

- `skills` prints available skills in aligned columns based on terminal width.
- Unknown skill names return a non-zero exit code.
