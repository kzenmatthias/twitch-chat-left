# Twitch Chat Position

A Chrome extension that lets you move Twitch chat to the left side of the video player.

## Features

- Toggle chat between left and right with a button in the chat header
- Works with expanded and collapsed sidebar
- Preference is saved and synced across sessions
- Handles Twitch SPA navigation between streams
- **Bingo helper** for towdan's custom Bingo: enter your DM'd numbers in a floating panel, and the extension auto-sends `!yoink` when PoguinBot pulls one of them

## Bingo helper

The Bingo panel only appears on `twitch.tv/towdan` (it activates and tears down as you navigate between channels).

1. Open the floating "Bingo" panel (top-left of the page).
2. Enter the numbers from your DM (comma or space separated) and click **Add**.
3. Tick **Auto-yoink on match** to arm the helper.
4. When PoguinBot posts "Bingo Pull … It's number N" and N is on your card, the extension types `!yoink` into chat and sends it.

To target a different channel, change `TARGET_CHANNEL` at the top of `bingo.js`.

There's also a manual **!yoink now** button and a **Clear** button. Click any number chip to remove it.

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
