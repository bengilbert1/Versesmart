// Maps theologian/commentator names to Wikipedia page titles for portrait lookup.
// Only authors used in the app are listed. Unmapped names fall back to initials.

export const AUTHOR_WIKI_TITLES: Record<string, string> = {
  // Classic public-domain commentators
  "Matthew Henry": "Matthew_Henry",
  "John Calvin": "John_Calvin",
  "Charles H. Spurgeon": "Charles_Spurgeon",
  "Charles Spurgeon": "Charles_Spurgeon",
  "Albert Barnes": "Albert_Barnes_(theologian)",
  "John Wesley": "John_Wesley",

  // Foundational
  Origen: "Origen",
  Augustine: "Augustine_of_Hippo",
  "Augustine of Hippo": "Augustine_of_Hippo",
  "John Chrysostom": "John_Chrysostom",
  "Thomas Aquinas": "Thomas_Aquinas",

  // Church Fathers
  Athanasius: "Athanasius_of_Alexandria",
  Jerome: "Jerome",
  Ambrose: "Ambrose",
  "Gregory of Nazianzus": "Gregory_of_Nazianzus",
  Irenaeus: "Irenaeus",
  Tertullian: "Tertullian",
  "Cyril of Alexandria": "Cyril_of_Alexandria",

  // Reformation
  "Martin Luther": "Martin_Luther",
  "Huldrych Zwingli": "Huldrych_Zwingli",
  "Philip Melanchthon": "Philip_Melanchthon",
  "John Knox": "John_Knox",
  "William Tyndale": "William_Tyndale",

  // Modern
  "N. T. Wright": "N._T._Wright",
  "John Stott": "John_Stott",
  "J. I. Packer": "J._I._Packer",
  "D. A. Carson": "D._A._Carson",
  "Gordon Fee": "Gordon_Fee",
  "Tim Keller": "Timothy_Keller",
  "John Piper": "John_Piper_(theologian)",
  "Walter Brueggemann": "Walter_Brueggemann",
  "Jürgen Moltmann": "Jürgen_Moltmann",
  "Alister McGrath": "Alister_McGrath",
  "Derek Prince": "Derek_Prince_(minister)",

  // Global South — Africa
  "John Mbiti": "John_Mbiti",
  "Byang Kato": "Byang_Kato",
  "Mercy Amba Oduyoye": "Mercy_Amba_Oduyoye",
  "Kwame Bediako": "Kwame_Bediako",

  // Global South — Asia
  "Kosuke Koyama": "Kosuke_Koyama",
  "C. S. Song": "Choan-Seng_Song",
  "Ajith Fernando": "Ajith_Fernando",

  // Global South — Latin America
  "Samuel Escobar": "Samuel_Escobar",
  "René Padilla": "C._René_Padilla",
  "Orlando Costas": "Orlando_E._Costas",
  "Gustavo Gutiérrez": "Gustavo_Gutiérrez",
  "Elsa Tamez": "Elsa_Tamez",

  // First-class additions
  "George Müller": "George_Müller",
  "George Muller": "George_Müller",
  "Mother Teresa": "Mother_Teresa",
  "Saint Teresa of Calcutta": "Mother_Teresa",
};

export function wikiTitleForAuthor(author: string): string | null {
  return AUTHOR_WIKI_TITLES[author] ?? AUTHOR_WIKI_TITLES[author.trim()] ?? null;
}

async function fetchWikiThumb(title: string): Promise<string | null> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };
  return json.thumbnail?.source ?? json.originalimage?.source ?? null;
}

export const authorThumbQueryOptions = (author: string) => {
  const title = wikiTitleForAuthor(author);
  return {
    queryKey: ["author-thumb", title ?? author],
    queryFn: () => (title ? fetchWikiThumb(title) : Promise.resolve(null)),
    enabled: !!title,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  };
};
