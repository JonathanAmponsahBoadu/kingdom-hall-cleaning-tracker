# Setting up the cleaning reminder (Windows Task Scheduler)

One-time setup on the laptop that'll be running the tracker. After this,
it's fully automatic — no browser needs to be open for the notification
itself to fire.

## 0. Host the tracker somewhere with HTTPS

Done — this is hosted on Vercel already.

## 1. Point the script at your URL

Done — `show-cleaning-reminder.ps1` already points at
`https://kingdom-hall-cleaning-tracker.vercel.app/?confirm=1`.

## 2. Open Task Scheduler

Press `Win`, type **Task Scheduler**, open it.

## 3. Create the task

- Right panel → **Create Task…** (not "Create Basic Task" — this one gives
  you the two-trigger control you need).
- **General** tab:
  - Name: `Cleaning Tracker Reminder`
  - Select **Run only when user is logged on** (it needs an active
    desktop session to show a toast — leave "run whether logged on or
    not" unchecked).
- **Triggers** tab → **New…** (add this twice, once per row below):

  | Begins the task | Settings |
  |---|---|
  | On a schedule → Weekly | Recur every 1 week, check **Tuesday**, start time **8:15:00 PM** |
  | On a schedule → Weekly | Recur every 1 week, check **Sunday**, start time **5:45:00 PM** |

- **Actions** tab → **New…**:
  - Action: **Start a program**
  - Program/script: `powershell.exe`
  - Add arguments:
    ```
    -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\path\to\kingdom-hall-cleaning-tracker\scripts\show-cleaning-reminder.ps1"
    ```
    (swap in wherever this project actually lives on the laptop — right-click
    the `.ps1` file → **Copy as path** to grab it exactly.)
- **Conditions** tab: if this is a laptop, uncheck **Start the task only
  if the computer is on AC power** — otherwise it silently won't fire on
  battery.
- **Settings** tab: leave defaults, OK.

## 4. Test it

Right-click **Cleaning Tracker Reminder** in the task list → **Run**. A
notification should appear within a couple of seconds; clicking it opens
the tracker and — if a second screen is connected — offers the "Is the
closing prayer over?" prompt.

## Changing the times later

Open the task → **Triggers** tab → edit either trigger's time directly.
Nothing in the tracker's own Settings controls this — that's deliberate
(a website can't reach out and edit Task Scheduler on its own), so this
is the one place the schedule lives.

## Changing the browser or how long it stays on screen

Both are settings near the top of `show-cleaning-reminder.ps1`:

- `$PreferredBrowser` — `"edge"` or `"chrome"` (the other is the fallback).
- `$ToastStay` — `"short"` (~7 s), `"long"` (~25 s) or `"untilDismissed"`.
  Windows doesn't allow an exact number of seconds per notification; for
  that, use Windows Settings > Accessibility > Visual effects > "Dismiss
  notifications after this amount of time".

Either way the notification then waits in the notifications panel.
