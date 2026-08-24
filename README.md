# Kingdom Hall Cleaning Tracker

A pure front-end dashboard for New Legon Twi Congregation's Field Service
Group cleaning rotation. No backend, no build step — just HTML/CSS/JS.

## Opening it

Double-click `index.html`, or serve the folder with any static server
(e.g. `npx serve .`) if your browser blocks local `fetch`/module features —
this project doesn't need one, but a server is handy if you later add assets.

To publish it for others (e.g. GitHub Pages, Netlify, Vercel): just deploy
this folder as-is, nothing to build.

## How the rotation is calculated

Each cleaning **block** runs **Sunday → the following Saturday** and belongs
to exactly one group: that Sunday's **weekend** cleaning, plus one
**midweek** cleaning inside the same block. The next Sunday starts the next
group, cycling 1 → 2 → 3 → 4 → 5 → 6 → 1...

This is anchored on one known fact (in [js/data.js](js/data.js)):

```js
const ANCHOR_SUNDAY_UTC = Date.UTC(2026, 7, 23); // Sun 23 Aug 2026
const ANCHOR_GROUP = 2;                          // = Group 2
```

Everything else — which group is on duty this week, next week, last month,
or next year — is computed from that anchor plus today's date. Ghana
(Africa/Accra) has no daylight saving and sits at UTC+0 year-round, so the
site reads a `Date`'s **UTC** fields directly as Ghana wall-clock time —
accurate no matter what timezone the visitor's device is set to.

If the rotation ever gets out of sync with reality (a skipped week, a swap
between groups), just update `ANCHOR_SUNDAY_UTC` / `ANCHOR_GROUP` to a
currently-correct Sunday and group.

## Midweek meeting day/time changes

The default midweek day/time (Tuesday 6:30 PM) and weekend time (Sunday
4:00 PM) can be changed from the ⚙ **Settings** panel. For the occasional
one-off week where the meeting moves to a different day, use **One-off
Midweek Changes** in the same panel instead of touching the default — it
only affects that specific week.

## Editing the group rosters

Group membership lives in [js/data.js](js/data.js) as the `GROUPS` object.
Edit the arrays there directly when membership changes.

## Data storage

Everything you set in Settings (default times, one-off overrides) and any
cleaning history you mark (Completed/Missed + notes) is saved in your
browser's `localStorage` only — nothing leaves your device, and it won't
sync between browsers/devices. "Reset all local data" in Settings clears it.

## Files

```
index.html        page structure
css/style.css      all styling + animations
js/data.js         groups, congregation name, rotation anchor, defaults
js/app.js          scheduling math, rendering, interactions
```
