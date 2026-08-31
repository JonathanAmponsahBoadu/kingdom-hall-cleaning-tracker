# show-cleaning-reminder.ps1
#
# Fires a native Windows toast notification reminding that meetings are
# about to end. Clicking it opens the Kingdom Hall Cleaning Tracker with
# a `?confirm=1` marker, which triggers the "Is the closing prayer over?"
# confirmation in the app — Yes takes over a connected second screen.
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
$TrackerUrl = "https://YOUR-USERNAME.github.io/kingdom-hall-cleaning-tracker/?confirm=1"
# ---------------------------------------------------------------------

$AppId = "Microsoft.Windows.Explorer"  # borrows Explorer's identity so no separate app registration is needed
$Title = "New Legon Twi Congregation"
$Body  = "Meetings are about to end. Click to display cleaning group after Prayer."

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

# No `scenario` attribute below = default behavior: shows briefly, then
# sits quietly in the Action Center (the bell icon) until opened from
# there. To make it instead stay visibly on screen until dismissed, add
# scenario="reminder" to the <toast> tag (see the chat notes on this).
$toastXml = [xml]@"
<toast launch="$TrackerUrl" activationType="protocol">
  <visual>
    <binding template="ToastGeneric">
      <text>$Title</text>
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
