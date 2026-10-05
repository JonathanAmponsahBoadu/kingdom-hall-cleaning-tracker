/**
 * data.js — static congregation data + tunable defaults.
 * Nothing in here talks to a server; everything the site needs lives in the
 * browser (this file + localStorage overrides set from the Settings panel).
 */

// The 6 Field Service Groups, transcribed from the printed group list.
// Edit names here any time membership changes.
const GROUPS = {
  1: [
    "Andrews A. Bulley", "Charles Appiah Jnr", "Eran Bulley", "Beatrice Bulley",
    "Edna Bulley", "Elinore Bulley", "Eva Bulley", "Faustina Attuah",
    "Alice Adjei", "Esther Asare", "Elice Bulley", "Comfort Asare",
    "Evelyn Amoah", "Frederick Yamoah", "Japheth Yamoah"
  ],
  2: [
    "Aikins Osei Boateng", "Edmund Okraku", "Nelly Brown", "Duncan William A.",
    "Precious Aboagye", "Joseph Osei", "Stephen Osei", "Joel Abakah Faraday",
    "Obed Quaye", "Lydia Osei", "Gifty Okraku", "Joram Okraku"
  ],
  3: [
    "Charles Appiah Snr", "Richard Hinson", "Lois Dufie Appiah", "Margaret Broni",
    "Johnson Broni", "Stella Ankomah", "Matilda Appiah", "Christiana Antwi",
    "Edwina Appiah", "Millicent Hinson", "Roseline Hinson", "Jasmine A. Boadu",
    "Patricia A. Boadu", "Jephthah A. Boadu", "Godsway Mensah", "Regina Mensah"
  ],
  4: [
    "George Anokye", "Benjamin Ofori", "Hannah Anokye", "Jessica Anokye",
    "Margaret Ofori", "Nathaniel Anokye", "Vida Ayeh", "Mercy Oforiwaa",
    "Alex Ofori Nkansah", "Ruth Nkansah", "Christabel O. Osei",
    "Rebecca Acheampong", "Christopher Akoto", "Jonathan A. Boadu"
  ],
  5: [
    "James Whittle", "Patrick Issaka", "Obed Appiah", "Samantha Ussher",
    "Stella M. Ussher", "Constance Ntim", "Edna Whittle", "Frederick Ussher",
    "Richard Ntim", "Stella Appiah", "Emmanuel Tetteh", "Paulina Larweh",
    "Esther Howard"
  ],
  6: [
    "Emmanuel Opare", "Augustine Gbediame", "Alice Adubea Opare", "Christiana Duodu",
    "Martha Tetteh", "Constance Ampomah", "Naomi Tetteh", "Derrick Apenteng",
    "Mabel Amponsah", "Lydia Nyarkoh", "Ruth K. Apenteng", "Juliet Apenteng",
    "Kelvin Apenteng", "Antoinnete Gbediame", "Isaac Kofi Acquah"
  ]
};

const CONGREGATION_NAME = "New Legon Twi Congregation";

// Group Leader / Assistant for each group (the two bolded names at the top
// of each list on the printed sheet). Kept as explicit maps — rather than
// always reading GROUPS[g][0]/[1] — so re-ordering a roster later doesn't
// silently change who's shown as the leader.
const GROUP_LEADERS = {
  1: "Andrews A. Bulley",
  2: "Aikins Osei Boateng",
  3: "Charles Appiah Snr",
  4: "George Anokye",
  5: "James Whittle",
  6: "Emmanuel Opare"
};
const GROUP_ASSISTANTS = {
  1: "Charles Appiah Jnr",
  2: "Edmund Okraku",
  3: "Richard Hinson",
  4: "Benjamin Ofori",
  5: "Patrick Issaka",
  6: "Augustine Gbediame"
};

// --- Rotation anchor -------------------------------------------------
// A group's duty is a "block" that runs from Saturday 12:00 AM to the next
// Saturday 12:00 AM: the weekend (Sat + Sun) first, then Mon-Fri midweek.
// The next Saturday at 12:00 AM starts the next group.
//
// Anchor fact (confirmed against the live schedule): the block that starts
// Saturday 22 Aug 2026 belongs to Group 2.
const ANCHOR_SATURDAY_UTC = Date.UTC(2026, 7, 22, 0, 0, 0); // Aug is month index 7
const ANCHOR_GROUP = 2;
const GROUP_COUNT = 6;

// Ghana (Africa/Accra) has no DST and sits at UTC+0 year-round, so reading
// a Date's *UTC* fields is exactly Ghana wall-clock time — no timezone
// library needed for correctness.
const DAY_MS = 24 * 60 * 60 * 1000;

// Phases inside a block, as day offsets from the block's Saturday start:
// weekend = Sat + Sun (0 to 2), midweek = Mon-Fri (2 to 7).
const PHASES = {
  weekend: { startDay: 0, endDay: 2 },
  midweek: { startDay: 2, endDay: 7 }
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STORAGE_KEYS = {
  theme: "khct.theme",
  themeTemp: "khct.themeTemp",
  secondScreenEnabled: "khct.secondScreen.enabled.v1",
  secondScreenShowButton: "khct.secondScreen.showButton.v1",
  voiceAnnouncement: "khct.voice.enabled.v1",
  voiceName: "khct.voice.name.v1",
  secondScreenBannerSeen: "khct.secondScreen.bannerSeen.v1"
};
