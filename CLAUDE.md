# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**quizaccess_proctoring** is a Moodle Quiz Access Rule plugin that adds webcam-based proctoring to quizzes. It captures student images at configurable intervals during quiz attempts and optionally performs face recognition via the Brain Station API to detect identity mismatches.

- **Package**: `quizaccess_proctoring`
- **Plugin type**: Quiz access rule (`mod/quiz/accessrule/proctoring`)
- **Moodle requirement**: 4.2+ (`$plugin->requires = 2023100900`)
- **License**: GPL v3

## Development Commands

This plugin runs inside a Moodle installation. It must be located at `mod/quiz/accessrule/proctoring/` within a Moodle root.

### Running Tests

```bash
# From the Moodle root directory (not the plugin directory):
php vendor/bin/phpunit --configuration mod/quiz/accessrule/proctoring/phpunit.xml

# Run a single test file:
php vendor/bin/phpunit --configuration mod/quiz/accessrule/proctoring/phpunit.xml mod/quiz/accessrule/proctoring/tests/rule_test.php
```

### Building JavaScript (AMD modules)

```bash
# From Moodle root, using grunt:
npx grunt amd --root=mod/quiz/accessrule/proctoring
```

Source JS files are in `amd/src/`, minified output goes to `amd/build/`.

### Moodle Coding Standards

```bash
# If phpcs is configured with Moodle standards:
phpcs --standard=moodle mod/quiz/accessrule/proctoring/
```

## Architecture

### Moodle Version Compatibility

The plugin supports both Moodle 4.2+ and older versions via class aliases in `rule.php`:
- Moodle 4.2+: extends `\mod_quiz\local\access_rule_base`
- Older: extends legacy `\quiz_access_rule_base`

This is handled at the top of `rule.php` using `class_exists()` checks and `class_alias()`. The main class is always `quizaccess_proctoring`.

### Core Components

**`rule.php`** — Main access rule class (`quizaccess_proctoring`). Implements preflight checks (webcam consent modal), quiz settings form additions, and integrates face validation. This is the entry point for Moodle's quiz access rule system.

**`lib.php`** — Library of standalone functions (prefixed `quizaccess_proctoring_`). Handles file serving (`pluginfile`), face match execution, image management, and settings retrieval. This is a large file (~37KB) that contains most of the business logic.

**`classes/external.php`** — Web service API (`quizaccess_proctoring_external`). Exposes two AJAX endpoints:
- `send_camshot` — receives base64 webcam images during quiz attempts
- `validate_face` — validates student face before quiz start

**`classes/proctoring_observer.php`** — Event observer for quiz attempt started/submitted events.

**`classes/screenshot.php`** — Handles screenshot storage using Moodle's File API (component: `quizaccess_proctoring`, file areas: `picture`, `user_photo`).

### Scheduled Tasks (`classes/task/`)

| Task | Schedule | Default | Purpose |
|------|----------|---------|---------|
| `initiate_facematch_task` | Every 5 min | Disabled | Queues face matching jobs |
| `execute_facematch_task` | Every 2 min | Disabled | Processes queued face matches via BS API |
| `delete_images_task` | Every 1 min | Enabled | Cleans up images marked for deletion |

### Database Tables (defined in `db/install.xml`)

- **`quizaccess_proctoring`** — Per-quiz proctoring settings (quizid, proctoringrequired flag)
- **`quizaccess_proctoring_logs`** — Webcam capture log (image URLs, face match scores, deletion tracking)
- **`quizaccess_proctoring_face_images`** — Extracted face data linked to logs or user images via `parent_type`/`parentid`
- **`quizaccess_proctoring_facematch_task`** — Face matching job queue
- **`quizaccess_proctoring_fm_warnings`** — Face mismatch alerts per user/quiz
- **`quizaccess_proctoring_user_images`** — Admin-uploaded reference profile images

### Capabilities (`db/access.php`)

- `quizaccess/proctoring:sendcamshot` — Send webcam snapshots (student, manager)
- `quizaccess/proctoring:viewreport` — View proctoring reports (teacher, editingteacher, manager)
- `quizaccess/proctoring:deletecamshots` — Delete captured images (editingteacher, manager)
- `quizaccess/proctoring:analyzeimages` — Run face analysis (teacher, editingteacher, manager)

### JavaScript (AMD modules in `amd/src/`)

- `proctoring.js` — Main webcam capture loop during quiz attempts
- `startAttempt.js` — Quiz attempt initialization
- `validateFace.js` — Client-side face validation using face-api.js
- `validateAdminUploadedImage.js` — Validates admin-uploaded reference images
- `userpic_modal.js` — User picture modal
- `lightbox2.js` — Third-party image gallery (Lightbox2 v2.11.3)

Client-side face detection uses **face-api.js** with SSD MobileNet V1 models (in `thirdpartylibs/models/`).

### Admin Pages (top-level PHP files)

`report.php`, `proctoringsummary.php`, `userslist.php` — Reporting and user management views. `analyzeimage.php`, `analyzesingleimage.php` — Batch/single face analysis triggers. `bulkdelete.php`, `delete_user_image.php`, `trigger_delete.php` — Image deletion handlers. `upload_image.php` — Admin reference image upload.

### Plugin Settings (`settings.php`)

Key settings under `quizaccess_proctoring/`:
- `autoreconfigurecamshotdelay` (default: 30) — Capture interval in seconds
- `autoreconfigureimagewidth` (default: 230) — Image width in pixels
- `fcmethod` — Face recognition method ("BS" or "None")
- `bsapi` / `bs_api_key` — Brain Station API endpoint and key
- `threshold` (default: 68) — Face match threshold percentage
- `fcheckstartchk` — Enable face validation on quiz start

## Coding Conventions

- Follow Moodle coding standards (PHP, JS, CSS)
- All PHP functions in `lib.php` are prefixed with `quizaccess_proctoring_`
- Database changes go through XMLDB (`db/install.xml` + `db/upgrade.php`)
- Language strings in `lang/en/quizaccess_proctoring.php`
- Templates use Mustache format in `templates/`
- Use Moodle File API for all image storage (never write directly to disk)
- All web service parameters must be validated through Moodle's external API pattern