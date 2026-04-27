# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] - 2026-04-02

### Fixed
- GitHub Copilot adapter: move YAML frontmatter before managed-file header so Copilot CLI can parse it correctly (was causing "missing or malformed YAML frontmatter" errors)
- GitHub Copilot adapter: skills were missing `name` and `description` frontmatter entirely; now emitted with proper YAML block
- GitHub Copilot adapter: commands now emit `.github/skills/{name}/SKILL.md` files (previously `emitCommand()` returned an empty array, making commands invisible to Copilot CLI); commands are now invocable as `/command-name` slash commands

## [0.4.0] - 2026-04-02

### Added
- `asdm init`: provider and profile selection is now fully interactive (prompted when not passed as flags)
- `asdm sync`: new `--clean` flag removes orphaned profile files that are no longer in the active config

### Fixed
- CI: restrict Validate Registry workflow to branch pushes only (was incorrectly triggering on tags)

## [0.3.0] - 2026-04-02

### Added
- New `agents-dir` provider that installs agents to `~/.agents` for cross-provider support

### Documentation
- Added clean working tree validation step to release checklist

## [0.2.0] - 2026-04-01

### Added
- `asdm templates` command for listing and applying project templates
- Husky integration for pre-commit registry validation hooks
- `asdm init --global` and `asdm clean --global` for machine-wide provider config management
- Global config fallback: local `.asdm.json` → `~/.config/asdm/config.json` → error
- `--global` flag on `asdm sync` and `asdm verify` to target global provider config directories
- Integration tests for global sync/verify/clean flows

### Fixed
- Exit code 3 ("needs sync") now correctly returned by `asdm verify` when lockfile is outdated

## [0.1.2] - 2026-04-01

### Added
- Registry manifest is now uploaded as a `manifest.json` release asset on GitHub Releases
- Default registry URL now points to the published release manifest asset

### Fixed
- Asset downloads now use `raw.githubusercontent.com` URLs (previously used API URLs that returned JSON metadata instead of raw content)
- Release workflow: manifest file correctly renamed to `manifest.json` before upload

## [0.1.1] - 2026-04-01

### Changed
- Package renamed from `asdm` to `asdm-cli` on npm to avoid an unregistered scope conflict

### Fixed
- CLI: replaced `process.exit()` with `process.exitCode` assignment for graceful shutdown on Windows
- Package: added `repository.url` field for npm provenance verification
- Publishing: restored `--access public` flag required for provenance on new scoped packages
- Registry validator: removed volatile `built_at` and `commit_sha` field checks that caused spurious CI failures
- Manifest build: removed volatile fields to break the CI regeneration loop

## [0.1.0] - 2026-04-01

### Added
- Complete ASDM Phase 1–5 CLI and registry system: `init`, `sync`, `verify`, `clean`, `gitignore`, `doctor`, `status`, `telemetry` commands
- Multi-provider output adapters: OpenCode, Claude Code, GitHub Copilot
- SHA-256 integrity verification for all synced assets via `.asdm-lock.json`
- Static registry with agents, skills, commands, and profiles
- JSON Schema validation for all registry asset types
- `AGENTS.md` developer guide for AI coding agents

[Unreleased]: https://github.com/lennartpollvogt/asdm/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/lennartpollvogt/asdm/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/lennartpollvogt/asdm/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/lennartpollvogt/asdm/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lennartpollvogt/asdm/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/lennartpollvogt/asdm/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lennartpollvogt/asdm/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lennartpollvogt/asdm/releases/tag/v0.1.0
