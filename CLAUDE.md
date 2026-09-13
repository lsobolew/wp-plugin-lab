# Working in this repository

This is **WP Plugin Lab**: a WordPress plugin development environment plus the plugin it builds.

## Read the skills first

`.claude/skills/` holds the official [WordPress agent skills](https://github.com/WordPress/agent-skills).
They cover plugin architecture, REST APIs, blocks, WP-CLI, performance and the WordPress.org
directory guidelines. Consult them before writing WordPress code - they are more current than
anything memorised.

Keep them fresh with `./bin/wpx skills update` (a weekly CI job opens a PR for the same thing).

## Golden rules

1. **PHP only runs in containers.** The host has no working PHP. Never suggest `composer`,
   `phpunit`, `phpcs` or `wp` as host commands - use `./bin/wpx sh <target> -- '<command>'` or the
   dedicated `wpx` commands.
2. **Never run `wp plugin install` against a mounted plugin.** `plugins/` is bind-mounted into
   every container; WordPress deletes the target directory before unpacking, which destroys the
   working copy on disk. Use `./bin/wpx build --verify`, which unpacks into a throwaway directory.
3. **Changes must be proven on more than one WordPress version.** Anything touching rewrite rules,
   the block editor, REST or multisite gets tested with `./bin/wpx test --targets=latest,min`
   at minimum. The matrix exists because those are exactly the things that break.
4. **Free and Pro are separate plugins.** The paid add-on may only use the public extension points
   of the free plugin (`myplugin_modules`, `myplugin_register_modules`, `myplugin_rest_item`,
   `myplugin_settings_defaults`). Reaching into internals is a bug, not a shortcut.
5. **Bump `Core\Api::VERSION`** when the extension contract changes, and raise
   `MY_PLUGIN_PRO_MIN_CORE_API` in the add-on to match.

## Layout

```
plugins/my-plugin/       free edition (WordPress.org)
plugins/my-plugin-pro/   paid add-on
cli/, bin/wpx            the environment CLI
env/                     Dockerfile, entrypoint, compose renderer input
dashboard/               local web dashboard
tests/e2e/               Playwright specs (free/ and pro/)
templates/features/      archived modules for wpx feature add
wp-matrix.json           which WordPress versions matter
starter.json             plugin identity, editions, features, skills
```

## Before calling work done

```bash
./bin/wpx test lint analyse --targets=latest
./bin/wpx test unit integration --targets=latest,min --edition=both
./bin/wpx test e2e --targets=latest --edition=both
```

Generated files (`env/docker-compose.gen.yml`, `plugins/*/build/`, `.wplab/`) are never edited by
hand - regenerate them instead.
