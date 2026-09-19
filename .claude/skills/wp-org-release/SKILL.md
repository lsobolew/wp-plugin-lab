---
name: wp-org-release
description: "Use when publishing a WordPress plugin to the WordPress.org directory: writing or fixing readme.txt (headers, sections, the short description limit, Stable tag), preparing directory assets (banner, icon, screenshots), building the submission zip, understanding the review process, and shipping updates over SVN afterwards. Also use when Plugin Check reports readme or packaging problems."
compatibility: "Complements the official wp-plugin-directory-guidelines skill, which covers the 18 directory guidelines but not the readme.txt file format or the release mechanics."
---

# Releasing to the WordPress.org directory

The directory accepts **a complete, ready-to-use zip** - the same file you would upload by hand on
the Plugins screen. Everything else (readme format, assets, SVN) hangs off that.

## What you submit

```bash
./bin/wpx build --edition=free --verify
```

That produces `dist/<slug>-<version>.zip` with the plugin in a single top-level directory, built
the way a release is built: development files excluded through `.distignore`, production Composer
autoloader, no `vendor/` when the plugin has no third-party runtime code. `--verify` unpacks it on
a running site and activates it, which catches a package missing files before a reviewer does.

Before submitting, run the reviewers' own tool:

```bash
./bin/wpx test plugin-check --targets=latest
```

It runs against a copy assembled the way a release is, so what it sees is what the reviewer sees.
It fails the run on errors and prints warnings without failing.

## readme.txt

This is the plugin's shop window and the file most first submissions get wrong.

### Header block

```
=== Plugin Name ===
Contributors: wporg-username, another-username
Tags: icon, block, svg
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

One sentence, at most 150 characters, no markup.
```

| Field | Rule |
|---|---|
| `Contributors` | WordPress.org usernames, not display names. Wrong names silently credit nobody. |
| `Tags` | Up to 5 are indexed. More is not better; unrelated tags read as keyword stuffing, which is a guideline violation. |
| `Requires at least` | The oldest WordPress you actually test on. |
| `Tested up to` | The newest WordPress you have run it against. Keep it current - a stale value makes the plugin look abandoned and triggers a warning on the plugin page. |
| `Requires PHP` | The oldest PHP you test on. |
| `Stable tag` | **Must equal the `Version:` header in the main plugin file.** A mismatch means users download the wrong code, or nothing at all. Never leave it as `trunk` for a release. |
| `License` / `License URI` | Must be GPL-compatible. |

The line after the blank line is the **short description**: at most 150 characters, plain text. Longer
is truncated on the directory page.

### Sections

`== Description ==` and `== Changelog ==` carry the weight. `== Installation ==`,
`== Frequently Asked Questions ==`, `== Screenshots ==` and `== Upgrade Notice ==` are optional but
expected by users.

- **Screenshots** are a numbered list; entry *n* maps to `screenshot-n.png` in the assets directory.
- **Changelog** newest first, one heading per version: `= 1.2.0 =`.
- **Upgrade Notice** entries must be short - they appear inline in the update prompt.

Formatting is a restricted Markdown: `**bold**`, `*italic*`, backticks for code, links, and lists.
Headings inside sections use `= Heading =`.

### The mistakes that cost a review round

1. `Stable tag` not matching the plugin `Version:`.
2. A short description over 150 characters.
3. A plugin name or slug containing a trademarked or restricted term - **"plugin" and "wordpress"
   are both restricted in names and slugs**, as are other projects' brands.
4. `Tested up to` naming a WordPress version that does not exist yet.
5. Tags used for competitors' names.
6. A plugin name built only from generic words - the one that actually costs most first
   submissions a round. See [The name](#the-name).

Details and the full field reference: `references/readme-txt.md`.

## Directory assets

These live in the SVN `assets/` directory, **beside** `trunk` and `tags`, never inside the plugin
zip. In this repository they are kept in `.wordpress-org/` and uploaded by the deploy workflow.

| File | Size | Notes |
|---|---|---|
| `banner-772x250.(png\|jpg)` | 772×250 | Required for a banner at all |
| `banner-1544x500.(png\|jpg)` | 1544×500 | Retina; only works alongside the standard one |
| `icon-128x128.(png\|jpg)` | 128×128 | |
| `icon-256x256.(png\|jpg)` | 256×256 | Retina |
| `icon.svg` | vector | Needs a PNG fallback as well |
| `screenshot-1.(png\|jpg)` | any | Lowercase names only; numbering matches readme.txt |

Banners up to 4 MB, icons 1 MB, screenshots 10 MB. Localised variants append a locale:
`banner-772x250-es_ES.png`.

## The name

**The slug is permanent.** It comes from the plugin name at submission time and cannot be changed
after approval - only the display name can. Getting it wrong costs a review round at best, and the
directory review is the place where it is caught.

A name built only from words describing the function is pended as generic. This is what the team
wrote back about `image-icons`:

> a generic descriptive name [that] does not begin with a distinctive brand or identifier

The fix is one distinctive word at the front - a brand, a coined term, or the author's handle -
carried by both the display name and the slug: `Sobol Image Icons` / `sobol-image-icons`. Adding
another descriptive adjective is not a fix; "Advanced Image Icons" is as generic as the original.
`sobol-` is the prefix this user's plugins use.

Someone else's product name goes at the **end**, after "for": `sobol-sync-for-woocommerce`. A
trademark at the front implies an affiliation that does not exist, and a blend word built out of
one ("PricesPress") is worse. The same applies outside the name: usernames, URLs, banners and
icons are all checked for terms that could mislead.

Changing the name after a submission has been pended means replying in the same email thread and
**asking for the new slug explicitly** - renaming the files is not enough, because the reserved
permalink lives on the directory's side. Uploading the corrected zip before the reservation is
confirmed is fine; a text-domain warning at that point is expected.

`wpx init` warns when a slug is built entirely from generic words, which puts the decision on the
day the plugin is created rather than the day it is submitted.

## Submitting

1. Register on WordPress.org with an address you actually read, and allow mail from
   `plugins@wordpress.org`.
2. Upload the zip at <https://wordpress.org/plugins/developers/add/>.
3. Wait. Review takes up to 14 business days, and the queue is people reading code.
4. On approval you get an SVN repository.

## Publishing updates

After approval the directory is fed by SVN, not by zips:

```
/trunk           the current code
/tags/1.2.0      a copy of trunk at release time
/assets          banners, icons, screenshots
```

Release by bumping the version, copying trunk to a new tag, and pointing `Stable tag` at it. In this
repository:

```bash
./bin/wpx version 1.2.0        # header, constants, readme Stable tag, package.json, block.json
# update the changelog in readme.txt
./bin/wpx build --edition=free --verify
git commit -am "Release 1.2.0" && git tag v1.2.0 && git push --tags
```

`.github/workflows/deploy-wporg.yml` then pushes to SVN when run manually. It needs `SVN_USERNAME`
and `SVN_PASSWORD` in the repository secrets. It is deliberately not automatic: an SVN publish
cannot be undone.

## Things that get a plugin rejected

Covered in depth by the `wp-plugin-directory-guidelines` skill. The ones that touch packaging:

- Calling home, or loading code from outside the plugin, without disclosure and consent.
- Obfuscated or minified code with no readable source.
- An `Update URI` header, or any self-update mechanism - **the directory forbids it**. A plugin with
  its own updater belongs outside the directory, which is why a paid add-on is checked differently.
- Bundling a `vendor/` directory without the `composer.json` that produced it.
