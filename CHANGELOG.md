# Changelog

## [1.2.0] - 2026-05-17

### Added

- Bingo helper panel for towdan's custom Bingo: manually enter your numbers (DM'd to you), and the extension watches chat for PoguinBot's pull messages and auto-sends `!yoink` when one of your numbers is called
- Floating panel with add/remove number chips, auto-yoink toggle, manual `!yoink now` button, and a "Clear" button
- Draggable panel header — position persists across sessions and is re-clamped to viewport on resize
- 3-second delayed auto-yoink on match, with a loud blink/shake alert and pulsing button so you can click `!yoink now` to send sooner
- Pull-message parser: gated to author `PoguinBot`, reads message body only (ignores badge/username text), takes the last 1–99 number in the body, and skips winner announcements
- Panel is scoped to `twitch.tv/towdan` (activates/tears down on SPA navigation)
- State persisted in `chrome.storage.local`

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
