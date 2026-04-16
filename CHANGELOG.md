# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `docs/IMPLEMENTATION-GUIDE.md` - Extension API usage guide for pi.exec()

### Changed
- Extension: Use `pi.exec()` instead of `ctx.exec()` for all tools
- Extension: Updated tool descriptions to reflect pi.exec() requirements
- Extension: Fixed typo `ture_id` → `true_id` in as_read promptGuidelines

### Fixed
- Extension: Removed unnecessary `fullCommand` string building
- Extension: Updated as_pipe to support both `--true-id` and `--label` options

## [0.1.0] - 2026-04-16

### Added
- Initial release with AnchorScope protocol skills
- Extension with tools: as_read, as_write, as_pipe, as_paths, as_label
- Complete workflow implementation:
  - anchorscope-core (main coordinator)
  - anchorscope-anchoring-guide (practical strategies)
  - anchorscope-tutorial (CLI reference)
  - anchorscope-scope-anchoring (algorithm)
  - anchorscope-decomposer (SCOPED phase)
  - anchorscope-proposer (DRAFTED phase)
  - anchorscope-validator (REVIEWING phase)
  - anchorscope-integrator (COMMITTED phase)
  - anchorscope-buffer-reader (state management)

### Changed
- Refactored single anchorscope tool into multiple dedicated tools (as_read, as_write, etc.)
