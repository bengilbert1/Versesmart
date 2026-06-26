// Static roster of every commentator the app may surface from a known dataset.
// This is the single source of truth used to:
//   1) Seed the Admin Commentator Panel so every dataset voice is editable
//      even before a verse lookup has cached their commentary.
//   2) Detect dataset desync (any future addition here automatically appears
//      in the admin panel and supports portraits + metadata editing).
//
// AI-generated authors that surface dynamically (regional voices, etc.) are
// still merged in from the AI cache by `listSeenCommentators` — this static
// roster is unioned with that live capture.
//
// IMPORTANT: keep these arrays in sync with the dataset definitions in:
//   - src/components/ModernVoices.tsx       (MODERN_AUTHORS)
//   - src/lib/historical-commentary.functions.ts (HISTORICAL_GROUPS)

export const KNOWN_MODERN_AUTHORS: readonly string[] = [
  // Western
  "N. T. Wright",
  "John Stott",
  "J. I. Packer",
  "D. A. Carson",
  "Gordon Fee",
  "Tim Keller",
  "John Piper",
  "Walter Brueggemann",
  "Jürgen Moltmann",
  "Alister McGrath",
  "Derek Prince",
  // Africa
  "John Mbiti",
  "Byang Kato",
  "Mercy Amba Oduyoye",
  "Kwame Bediako",
  // Asia
  "Kosuke Koyama",
  "C. S. Song",
  "Ajith Fernando",
  // Latin America
  "Samuel Escobar",
  "René Padilla",
  "Orlando Costas",
  "Gustavo Gutiérrez",
  "Elsa Tamez",
  // Appended (gender balancing — append-only, never remove)
  "Fleming Rutledge",
  "Sarah Coakley",
  "Marianne Meye Thompson",
  "Beverly Roberts Gaventa",
] as const;

export const KNOWN_HISTORICAL_AUTHORS: readonly string[] = [
  // foundational
  "Origen",
  "Augustine",
  "John Chrysostom",
  "Thomas Aquinas",
  // fathers
  "Athanasius",
  "Jerome",
  "Ambrose",
  "Gregory of Nazianzus",
  "Irenaeus",
  "Tertullian",
  "Cyril of Alexandria",
  // reformation
  "Martin Luther",
  "Huldrych Zwingli",
  "Philip Melanchthon",
  "John Knox",
  "William Tyndale",
  // Appended (gender balancing — append-only, never remove)
  "Amy Carmichael",
  "Phoebe Palmer",
  "Edith Stein",
  // Appended (first-class additions — never remove)
  "George Müller",
  "Mother Teresa",
] as const;

export const KNOWN_COMMENTATORS: readonly string[] = [
  ...KNOWN_MODERN_AUTHORS,
  ...KNOWN_HISTORICAL_AUTHORS,
];
