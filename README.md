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

Each group's duty is a **block** that runs from **Saturday 12:00 AM to the
next Saturday 12:00 AM** (i.e. Friday 11:59 PM is the last minute of the
block). Inside it the weekend (Sat + Sun) comes first, then Mon–Fri is
midweek, all by the same group. At the next Saturday 12:00 AM the next
group takes over, cycling 1 → 2 → 3 → 4 → 5 → 6 → 1...

This is anchored on one known fact (in [js/data.js](js/data.js)):

```js
const ANCHOR_SATURDAY_UTC = Date.UTC(2026, 7, 22); // Sat 22 Aug 2026
const ANCHOR_GROUP = 2;                            // = Group 2
```

Everything else is computed from that anchor plus today's date. Ghana
(Africa/Accra) has no daylight saving and sits at UTC+0 year-round, so the
site reads a `Date`'s **UTC** fields directly as Ghana wall-clock time —
accurate no matter what timezone the visitor's device is set to.

If the rotation ever gets out of sync with reality, update
`ANCHOR_SATURDAY_UTC` / `ANCHOR_GROUP` to a Saturday and the group that
started on it.

## What the app shows

No meeting clock times are used. The app shows which group is on duty,
split into **Weekend** (Sat–Sun) and **Midweek** (Mon–Fri) phases that
begin at 12:00 AM, and counts down to the next phase. It is read-only.
(The Sunday 4 PM / Tuesday 6:30 PM reminder times live only in Windows
Task Scheduler.)

The Auto theme follows the same split: dark Monday–Friday, light Saturday
and Sunday, switching at Saturday 12:00 AM.

## Editing the group rosters

Group membership lives in [js/data.js](js/data.js) as the `GROUPS` object.
Edit the arrays there directly when membership changes.

## Data storage

Only display preferences (theme, second-screen options) are kept in the
browser's `localStorage`; nothing leaves your device. "Reset all local
data" in Settings clears them.

## Files

```
index.html         page structure
css/style.css      all styling + animations
js/data.js         groups, congregation name, rotation anchor, meeting times
js/app.js          scheduling math, rendering, interactions
img/               logos, icons, hall photos
scripts/           Windows Task Scheduler reminder (see TASK-SCHEDULER-SETUP.md)
```
