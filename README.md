# WP Plugin Lab

A starter for building WordPress plugins against **many WordPress versions at once**, with real
tests on every one of them, a dashboard to drive it, and a free/paid edition split baked in.

```bash
git clone <your-fork> my-plugin && cd my-plugin
npm install                 # the e2e runner and the dashboard
./bin/wpx doctor            # is this machine ready?
./bin/wpx init              # rename the starter into your own plugin
./bin/wpx skills install    # official WordPress skills for your AI agent
./bin/wpx up                # every WordPress version from wp-matrix.json
./bin/wpx panel             # http://127.0.0.1:7777
```

No PHP on your machine is required. Composer, PHPUnit, PHPCS, PHPStan and WP-CLI all run inside
the containers; only Node and Docker have to exist on the host.

## What you get

| | |
|---|---|
| **Version matrix** | One WordPress instance per entry in `wp-matrix.json`, any WordPress × any PHP pair, `latest` resolved live from api.wordpress.org. |
| **Tests** | `unit` (Brain Monkey), `integration` (real WordPress core test suite), `e2e` (Playwright), `lint` (PHPCS/WPCS), `analyse` (PHPStan), `plugin-check` (the WordPress.org reviewer's own tool). |
| **Dashboard** | `wpx panel` - start/stop/reset each version, run any suite, live log, results per version and edition. |
| **Plugin boilerplate** | Modular core with a settings screen, custom post type, REST API, WP-CLI commands and an editor block. Each module can be removed with one command. |
| **Free + Pro** | A paid add-on plugin that extends the free one through public hooks, with licensing and self-hosted updates. Both editions are a dimension of the test matrix. |
| **Agent skills** | The official [WordPress agent skills](https://github.com/WordPress/agent-skills), installed into `.claude/skills` and kept fresh by `wpx skills update` plus a weekly CI job. |
| **CI/CD** | GitHub Actions that expand `wp-matrix.json` into one job per WordPress version, build verified zips, and deploy to WordPress.org on demand. |

## Everyday commands

```bash
./bin/wpx up latest min              # start selected versions
./bin/wpx status                     # what is running where
./bin/wpx test                       # unit + integration + e2e, every version
./bin/wpx test e2e --targets=latest --edition=pro
./bin/wpx wp latest -- plugin list   # WP-CLI inside a container
./bin/wpx feature remove blocks      # drop a module you do not need
./bin/wpx version 1.2.0              # one version number, everywhere it is written
./bin/wpx build --edition=both --verify
./bin/wpx down                       # stop everything
```

Run `./bin/wpx` with no arguments for the full list.

## Documentation

- [Getting started](docs/getting-started.md) - from clone to a green test run
- [The version matrix](docs/matrix.md) - choosing which WordPress versions you support
- [Testing](docs/testing.md) - what each suite covers and when to reach for it
- [Free and Pro editions](docs/free-pro.md) - the add-on model, licensing, updates
- [Releasing](docs/release.md) - versioning, packaging, WordPress.org
- [Agent skills](docs/skills.md) - installing and updating the WordPress skill pack
- [Architecture](docs/architecture.md) - why the environment is built the way it is

## Licence

GPL-2.0-or-later, matching WordPress itself.
