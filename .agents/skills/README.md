# Agent skills

Instructions for AI coding agents working in this repository. Codex loads the canonical copy from
this directory. `./bin/wpx skills install` generates compatibility copies for the other targets in
`starter.json` → `skills.targets`.

## Maintained here

| Skill | What it covers |
|---|---|
| `wp-plugin-lab` | The `wpx` CLI, the version matrix, the test suites, blocks, themes, editions, releasing |
| `create-wp-plugin` | Turning this starter into a new plugin, end to end |
| `wp-org-release` | readme.txt, directory assets, the submission zip, and SVN updates |

Edit these freely - they are yours. `./bin/wpx upgrade` does not touch `.agents/`, so local changes
survive a lab upgrade.

Project skills only load once an agent is already inside the repository, which is too late for
"clone the starter and build me a plugin". Install them at user level so they work anywhere:

```bash
./bin/wpx skills global
```

That copies them into both `~/.agents/skills/` and `~/.claude/skills/`. Re-run it after `wpx
upgrade` to pick up newer wording.

## Installed from WordPress

Everything else here comes from the official
[WordPress agent skills](https://github.com/WordPress/agent-skills) project (GPL-2.0-or-later),
installed and updated by:

```bash
./bin/wpx skills install
./bin/wpx skills update
./bin/wpx skills status
```

`.agents/wplab-skills.lock.json` records the exact upstream commit. Do not edit upstream-managed
skill directories or the generated `.claude/skills/` copy by hand; the next update overwrites
them. To change which ones are installed, edit
`starter.json` → `skills.install` and run the installer again.

The installer replaces only the upstream skills it manages, so the three maintained here are safe.
