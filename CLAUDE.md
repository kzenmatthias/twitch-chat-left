# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension ("Twitch Chat Position") that runs on `https://www.twitch.tv/*`. It bundles three independent features into one set of content scripts:

1. **Chat position toggle** (`content.js` + `content.css`) — moves Twitch chat to the left of the player via a `tcl-chat-left` body class, with a toggle button injected into the chat header.
2. **Auto-claim channel points** (`points.js`) — polls for the claim-bonus button and clicks it after a randomized human-like delay.
3. **Bingo auto-yoink helper** (`bingo.js`) — scoped to `twitch.tv/towdan` only; watches chat for PoguinBot's number pulls and auto-sends `!yoink` when a saved number matches, via a floating draggable panel.

All three content scripts are injected together (`manifest.json`, `run_at: document_start`) and share the page's global scope per tab, so `points.js` and `bingo.js` are wrapped in their own IIFEs to avoid `STORAGE_KEY` redeclaration clashes with each other and with any future scripts. `content.js` is NOT wrapped in an IIFE — its top-level state (`currentPosition`) is intentionally global.

`popup.html`/`popup.js` is the toolbar popup UI for switching chat position and toggling auto-claim.

## Commands

```bash
npm install       # install dev dependencies (eslint, prettier)
npm run lint      # eslint .
npm run lint:fix  # eslint . --fix
npm run format    # prettier --write .
```

No test suite or build step exists. To try changes: open `chrome://extensions`, enable Developer mode, "Load unpacked" on this folder, then reload the extension after edits (Twitch tab also needs a refresh).

## Architecture notes

- **Persistence split**: chat position and auto-claim preference live in `chrome.storage.sync` (cross-device); the Bingo panel's state (numbers, panel position, called history) lives in `chrome.storage.local`. Don't mix these up when adding storage reads/writes.
- **Live updates via `chrome.storage.onChanged`**: both `content.js` and `points.js` listen for storage changes so the popup and content script(s) stay in sync without message passing.
- **SPA-aware DOM watching**: Twitch is a single-page app, so all three scripts use `MutationObserver`/polling rather than relying on page load events — e.g. `content.js` re-locates `.stream-chat-header` and re-injects its button whenever Twitch's own JS re-renders it, and `bingo.js` activates/tears down as the user navigates to/away from `/towdan`.
- **DOM selectors are fragile by design**: several selectors target Twitch's obfuscated/generated CSS class names (e.g. `ScCoreButton-sc-ocjdkq-0 glPhvE`, `.claimable-bonus__icon`). These will break silently if Twitch changes its frontend build — when debugging "feature X stopped working," suspect a selector mismatch first.
- **Bingo number extraction** (`bingo.js`): the pulled number is always the *last* 1-99 integer found in the chat message body (`extractPulledNumber`), and the author must match `PoguinBot` via one of several selectors (`AUTHOR_SELECTORS`) to handle both regular and announcement-style chat lines. To retarget the helper at a different channel/bot, change `TARGET_CHANNEL` at the top of `bingo.js`.
- **ESLint config** (`eslint.config.js`, flat config): browser globals + `chrome: "readonly"` for all files, Node globals for `eslint.config.js` itself; enforces `eqeqeq`, `no-var`, warns on `no-unused-vars`/`prefer-const`. Prettier config is in `.prettierrc`; `eslint-config-prettier` disables stylistic ESLint rules that would conflict.
- Bump `manifest.json`'s `version` and add an entry to `CHANGELOG.md` when shipping a user-visible change (existing convention, see changelog history).
