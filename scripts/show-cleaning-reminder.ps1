# show-cleaning-reminder.ps1
#
# Fires a native Windows toast notification reminding that meetings are
# about to end. Clicking it opens the Kingdom Hall Cleaning Tracker with
# a `?confirm=1` marker, which triggers the "Is the closing prayer over?"
# prompt in the app. The notification itself never touches the second
# screen — that happens from the prompt in the browser, on a click.
#
# Which browser opens (the second-screen jump only works in these two):
#   1. Microsoft Edge, if installed
#   2. Google Chrome, if Edge isn't
#   3. otherwise the Windows default browser — the page then asks you to
#      move the window to the second screen yourself and go fullscreen.
#
# This is meant to be run by Windows Task Scheduler, not by hand. See
# TASK-SCHEDULER-SETUP.md in this folder for the two triggers to add
# (Tuesday 8:15 PM, Sunday 5:45 PM) and where those times actually live
# (in the Scheduler itself — change them there, not in this file).

$ErrorActionPreference = "Stop"

# --- Edit this to your hosted tracker's URL (must be https://) -----------
# The Window Management / second-screen features need a secure (https)
# origin to work at all, so this has to point at a real hosted URL, not
# a local file.
$TrackerUrl = "https://kingdom-hall-cleaning-tracker.vercel.app/?confirm=1"

# --- Which browser opens when the notification is clicked ----------------
#   "edge"   -> Edge first, then Chrome if Edge isn't installed
#   "chrome" -> Chrome first, then Edge if Chrome isn't installed
# (If neither is installed, the Windows default browser is used.)
$PreferredBrowser = "edge"

# --- How long the notification stays on screen ---------------------------
#   "short"          -> about 7 seconds, then moves to the notifications panel
#   "long"           -> about 25 seconds, then moves to the notifications panel
#   "untilDismissed" -> stays on screen until you click or dismiss it
# Windows doesn't allow an exact number of seconds per notification. For an
# exact time, use Windows Settings > Accessibility > Visual effects >
# "Dismiss notifications after this amount of time" (applies to "short").
$ToastStay = "long"
# ---------------------------------------------------------------------

$AppId = "Microsoft.Windows.Explorer"  # borrows Explorer's identity so no separate app registration is needed
$Title = "Kingdom Hall Cleaning Tracker"
$Body  = "Meetings are about to end. Click to open Kingdom Hall Cleaning Tracker."

function Find-Browser([string]$ExeName, [string[]]$Fallbacks) {
    foreach ($root in "HKCU", "HKLM") {
        $key = "${root}:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$ExeName"
        $path = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue)."(default)"
        if ($path -and (Test-Path $path)) { return $path }
    }
    foreach ($p in $Fallbacks) { if (Test-Path $p) { return $p } }
    return $null
}

$edge = Find-Browser "msedge.exe" @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$chrome = Find-Browser "chrome.exe" @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")

# Put the preferred browser first; the other one is the fallback.
if ($PreferredBrowser -eq "chrome" -and $chrome) { $edge = $null }

if ($edge) {
    # Edge registers its own URL scheme, so a click always lands in Edge.
    $Launch = "microsoft-edge:$TrackerUrl"
}
elseif ($chrome) {
    # Chrome has no such scheme, so register a tiny per-user one (no admin
    # needed) that just opens the tracker URL in Chrome.
    $k = "HKCU:\Software\Classes\khct-chrome"
    New-Item -Path "$k\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path $k -Name "(default)" -Value "URL:Kingdom Hall Cleaning Tracker"
    Set-ItemProperty -Path $k -Name "URL Protocol" -Value ""
    Set-ItemProperty -Path "$k\shell\open\command" -Name "(default)" -Value "`"$chrome`" `"$TrackerUrl`""
    $Launch = "khct-chrome:open"
}
else {
    $Launch = $TrackerUrl   # default browser
}

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

# Small logo beside the text (uses the project's own icon if it's still next to this script).
$logo = Join-Path $PSScriptRoot "..\img\favicon-light.png"
$logoXml = ""
if (Test-Path $logo) {
    $logoUri = ([System.Uri](Resolve-Path $logo).Path).AbsoluteUri
    $logoXml = "<image placement=`"appLogoOverride`" hint-crop=`"circle`" src=`"$logoUri`"/>"
}

# Either way it ends up in the notifications panel (Action Center) afterwards.
$toastAttrs = switch ($ToastStay) {
    "untilDismissed" { 'scenario="reminder"' }
    "long"           { 'duration="long"' }
    default          { '' }
}
$launchEsc = [System.Security.SecurityElement]::Escape($Launch)
$toastXml = [xml]@"
<toast launch="$launchEsc" activationType="protocol" $toastAttrs>
  <visual>
    <binding template="ToastGeneric">
      $logoXml
      <text hint-style="title">$Title</text>
      <text>$Body</text>
    </binding>
  </visual>
</toast>
"@

$xmlDoc = New-Object Windows.Data.Xml.Dom.XmlDocument
$xmlDoc.LoadXml($toastXml.OuterXml)

$toast = [Windows.UI.Notifications.ToastNotification]::new($xmlDoc)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId)
$notifier.Show($toast)
