# Setting up the cleaning reminder (Windows Task Scheduler)

One-time setup on the laptop that'll be running the tracker. After this,
it's fully automatic — no browser needs to be open for the notification
itself to fire.

## 0. Host the tracker somewhere with HTTPS

The second-screen feature needs a real `https://` URL — it won't work
opened from a local file. If you don't already have this hosted, GitHub
Pages is free and this repo is already on GitHub — ask and I can set
that up in a couple of minutes.

## 1. Point the script at your URL

Open `scripts/show-cleaning-reminder.ps1` and edit this line near the top:

```powershell
$TrackerUrl = "https://YOUR-USERNAME.github.io/kingdom-hall-cleaning-tracker/?confirm=1"
```

Replace it with your actual hosted URL. Keep the `?confirm=1` on the end
— that's what tells the app to offer the second-screen confirmation.

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

## Changing whether it stays on screen until dismissed

By default the notification behaves like a normal Windows notification —
shows briefly, then moves into the Action Center. To make it instead stay
visibly on screen until you dismiss it, open `show-cleaning-reminder.ps1`
and add `scenario="reminder"` to the `<toast ...>` line, e.g.:

```
<toast launch="$TrackerUrl" activationType="protocol" scenario="reminder">
```
