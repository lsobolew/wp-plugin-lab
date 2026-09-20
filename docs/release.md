# Releasing

## Set the version

```bash
./bin/wpx version 1.2.0
```

A plugin version is written down in more places than anyone remembers, and WordPress.org rejects a
release where the header and the readme disagree. One command updates all of them:

- the `Version:` header in both plugins
- the `MY_PLUGIN_VERSION` / `MY_PLUGIN_PRO_VERSION` constants
- `Stable tag:` in `readme.txt`
- `package.json` and `block.json`
- the test and PHPStan bootstraps

Free and Pro can also follow independent release lines. Select one edition when only that plugin
is being released; omitting `--edition` retains the shared-version behavior:

```bash
./bin/wpx version 1.3.2 --edition=free
./bin/wpx version 2.34.4 --edition=pro
./bin/wpx version 3.0.0 --edition=both
```

Plugin versions do not change the extension contract version in `Core\Api::VERSION` or the
matching Pro minimum. Bump those only when the public extension API changes.

```bash
./bin/wpx version --sync-headers   # Requires at least / Tested up to, taken from wp-matrix.json
./bin/wpx version 1.2.0 --dry-run  # see the list without writing
./bin/wpx version 1.3.2 --edition=free --dry-run
```

## Build

```bash
./bin/wpx build --edition=both --verify
```

For each edition this builds the editor assets on the host, then assembles the package inside a
container: `.distignore` decides what ships, `composer install --no-dev --optimize-autoloader`
produces the autoloader users actually get, and the development manifests are dropped afterwards.
The zips land in `dist/`.

`--verify` then unpacks each zip into a throwaway directory on a running site, lints every file and
activates the plugin. It deliberately avoids `wp plugin install`: the plugin directory is
bind-mounted from the host, and WordPress deletes the target directory before unpacking - which
would destroy your working copy on disk.

## Check it the way WordPress.org will

```bash
./bin/wpx test plugin-check --targets=latest
```

Plugin Check is the reviewers' own tool. Failing it locally means the submission would be rejected.

## Tag and publish

```bash
git tag v1.2.0 && git push --tags
```

`release.yml` refuses to publish when the tag and every public plugin header disagree, then builds,
verifies and attaches only the ZIPs declared by the current public build manifest. Local editions
are never attached, even if an older ZIP remains in `dist/`.

Publishing to WordPress.org is a separate, manual workflow (`deploy-wporg.yml`, run from the
Actions tab) because an SVN publish cannot be undone. It needs `SVN_USERNAME` and `SVN_PASSWORD` in
the repository secrets, and takes directory assets - banner, icon, screenshots - from
`.wordpress-org/`.

## Checklist

```bash
./bin/wpx test all                      # every suite, every version, both editions
./bin/wpx version 1.2.0
# update the changelog in readme.txt and CHANGELOG.md
./bin/wpx build --edition=both --public-only --verify
git commit -am "Release 1.2.0" && git tag v1.2.0 && git push --tags
```
