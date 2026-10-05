# Twitch Chat Position

A Chrome extension that lets you move Twitch chat to the left side of the video player.

## Features

- Toggle chat between left and right with a button in the chat header
- Works with expanded and collapsed sidebar
- Preference is saved and synced across sessions
- Handles Twitch SPA navigation between streams
- **Auto-claim channel points**: when the green claim-bonus button appears, the extension clicks it after a random 5–25 second delay (toggleable from the popup)

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder

## Usage

Click the arrow button in the "Stream Chat" header to toggle chat position. You can also click the extension icon in the toolbar to switch.

## Development

```bash
npm install          # install dev dependencies
npm run lint         # check for issues
npm run lint:fix     # auto-fix ESLint issues
npm run format       # format with Prettier
```
