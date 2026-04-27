# Changelog

## [1.1.0] - 2026-04-27

### Added
- Toggle button in the Twitch chat header to switch chat between left and right
- Popup UI (extension icon) to switch chat position
- Position preference saved via `chrome.storage.sync` (persists across sessions)
- Support for both expanded and collapsed sidebar states
- ESLint + Prettier setup for code linting and formatting

### Fixed
- Player double-offset when switching streams via SPA navigation
- Player position reset when toggling back to right side

## [1.0.0] - 2026-04-27

### Added
- Initial release
- CSS-only approach to move Twitch chat to the left side of the video player
- Manifest V3 Chrome extension
