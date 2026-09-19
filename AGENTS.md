# Working in this repository

This is **WP Plugin Lab**: a WordPress plugin development environment plus the plugin it builds.

## Agent skills

Project skills live in `.agents/skills/`. Read the relevant skill before changing WordPress code:

- `wp-plugin-lab` covers this repository's CLI and workflow.
- `create-wp-plugin` covers creating a new plugin from this starter.
- `wp-org-release` covers WordPress.org readmes and releases.
- The remaining skills cover WordPress architecture, REST APIs, blocks, WP-CLI, performance,
  PHPStan, and directory guidelines.

Keep them current with `./bin/wpx skills update`. `.claude/skills/` is a generated compatibility
copy for Claude Code and must not be edited directly.

## Project Structure & Module Organization

The free plugin lives in `plugins/my-plugin/`; the paid add-on is in `plugins/my-plugin-pro/`. PHP sources are under each plugin's `src/`, block sources under `plugins/my-plugin/blocks/`, and PHPUnit tests under `tests/Unit/` and `tests/Integration/`. Browser tests are grouped by edition in `tests/e2e/free/` and `tests/e2e/pro/`. CLI code belongs in `cli/` and `bin/wpx`; container configuration is in `env/`, and dashboard assets are in `dashboard/`.

Do not hand-edit generated paths such as `.wplab/`, `env/docker-compose.gen.yml`, or `plugins/*/build/`.

## Build, Test, and Development Commands

- `npm install`: install dashboard and Playwright dependencies (Node 20+).
- `./bin/wpx doctor`: verify Docker and local prerequisites.
- `./bin/wpx up latest min`: start the newest and minimum supported WordPress targets.
- `./bin/wpx dev`: watch and rebuild TypeScript blocks with Vite.
- `./bin/wpx test`: run unit, integration, and end-to-end suites across configured targets.
- `./bin/wpx test all --targets=latest`: run tests plus types, PHPCS, PHPStan, and Plugin Check.
- `./bin/wpx build --edition=both --verify`: create and validate distributable ZIPs.

PHP tooling runs only inside containers. Use `wpx` commands or `./bin/wpx sh <target> -- '<command>'`, never host `composer`, `phpunit`, or `wp` commands.

## Coding Style & Naming Conventions

Follow `.editorconfig`: tabs by default; two spaces for YAML, JSON, and Markdown; LF endings and a final newline. PHP follows WordPress Coding Standards and PHP 7.4 compatibility, with PSR-4 class filenames such as `ItemsController.php`. TypeScript block components use descriptive lower-case directory names and files such as `edit.tsx` and `save.tsx`. Run `./bin/wpx test lint analyse types --targets=latest` before submitting.

## Testing Guidelines

Use `*Test.php` for PHPUnit and `*.spec.ts` for Playwright. Isolate unit logic with Brain Monkey; use `WP_UnitTestCase` for integration tests; exercise user-visible flows in e2e tests. REST, rewrite, block, or multisite changes must cover at least `latest,min`. Test both editions when extension behavior is affected.

## Commit & Pull Request Guidelines

Recent commits use concise, imperative, sentence-case subjects that describe the outcome (for example, `Run one WordPress on pull requests`). Keep commits focused. Pull requests should explain the behavior change, list commands and targets tested, link relevant issues, and include screenshots for dashboard, settings, or editor UI changes. Apply `ci:full` when version-sensitive behavior needs the complete WordPress/theme matrix.

## Safety & Compatibility

Never install over a bind-mounted plugin with `wp plugin install`; validate packages with `wpx build --verify`. Preserve public free/pro extension hooks, bump `Core\\Api::VERSION` when their contract changes, and add a block deprecation whenever static saved markup changes.

The paid add-on may use only the public extension points of the free plugin:
`myplugin_modules`, `myplugin_register_modules`, `myplugin_rest_item`, and
`myplugin_settings_defaults`. Raise `MY_PLUGIN_PRO_MIN_CORE_API` whenever the corresponding core API
version changes.

Blocks are TypeScript built with Vite. Do not reintroduce `@wordpress/scripts`, and do not edit
generated `index.asset.php` files.

## Before calling work done

Run checks in proportion to the change. The complete pre-submit suite is:

```bash
./bin/wpx test lint analyse types --targets=latest
./bin/wpx test unit integration --targets=latest,min --edition=both
./bin/wpx test e2e --targets=latest --edition=both
```
