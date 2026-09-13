# Getting started

## Requirements

- Docker Desktop (or any Docker with Compose v2)
- Node 20+

That is the whole list. PHP, Composer, WP-CLI, PHPUnit, PHPCS and PHPStan all live inside the
containers, so a broken or missing PHP on your machine changes nothing. `./bin/wpx doctor` says so
explicitly when it finds one.

## First run

```bash
npm install          # Playwright and the e2e helpers
./bin/wpx doctor     # Docker, ports, plugins, skills
./bin/wpx up latest  # build the image, download WordPress, install it
```

The first start takes a few minutes: it builds a PHP image and downloads a WordPress core. Later
starts take seconds. When it finishes you get a URL and credentials:

```
OK latest: WP 7.1 / PHP 8.4 -> http://localhost:8091
   Login: admin / password   Mailpit: http://localhost:8025
```

## Make it your plugin

```bash
./bin/wpx init
```

It asks for a slug, a display name, a PHP namespace and an author, then rewrites every file:
plugin headers, namespaces, constants, hook prefixes, text domain, option names, directory and file
names, for both the free and the paid edition. Use `--dry-run` first if you want to see the scope.

After renaming, rebuild the sites so they mount the new directories:

```bash
./bin/wpx reset --all
./bin/wpx test
```

## Install the WordPress agent skills

```bash
./bin/wpx skills install
```

This pulls the official WordPress skill pack into `.claude/skills/` and records the exact upstream
commit in `.claude/wplab-skills.lock.json`. Commit both - see [skills](skills.md).

## Run the dashboard

```bash
./bin/wpx panel
```

It listens on `127.0.0.1:7777` only. From there you can start, stop and reset each WordPress
version, run any test suite against any selection of versions and editions, and watch the output
live.

## Where things are

| Path | What it is |
|---|---|
| `wp-matrix.json` | Which WordPress versions you support |
| `starter.json` | Plugin identity, editions, features, skills |
| `plugins/<slug>/` | Your free plugin |
| `plugins/<slug>-pro/` | Your paid add-on |
| `tests/e2e/` | Playwright specs, split into `free/` and `pro/` |
| `.wplab/` | Logs, test results, caches (never committed) |
