// Bible book name translations per supported language.
// Keys match BIBLE_BOOKS[].name (English). Missing entries fall back to English.

import type { LanguageCode } from "./languages";

type BookMap = Record<string, string>;

const ES: BookMap = {
  Genesis: "Génesis", Exodus: "Éxodo", Leviticus: "Levítico", Numbers: "Números",
  Deuteronomy: "Deuteronomio", Joshua: "Josué", Judges: "Jueces", Ruth: "Rut",
  "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel", "1 Kings": "1 Reyes", "2 Kings": "2 Reyes",
  "1 Chronicles": "1 Crónicas", "2 Chronicles": "2 Crónicas", Ezra: "Esdras",
  Nehemiah: "Nehemías", Esther: "Ester", Job: "Job", Psalms: "Salmos", Proverbs: "Proverbios",
  Ecclesiastes: "Eclesiastés", "Song of Solomon": "Cantares", Isaiah: "Isaías",
  Jeremiah: "Jeremías", Lamentations: "Lamentaciones", Ezekiel: "Ezequiel", Daniel: "Daniel",
  Hosea: "Oseas", Joel: "Joel", Amos: "Amós", Obadiah: "Abdías", Jonah: "Jonás",
  Micah: "Miqueas", Nahum: "Nahúm", Habakkuk: "Habacuc", Zephaniah: "Sofonías",
  Haggai: "Hageo", Zechariah: "Zacarías", Malachi: "Malaquías",
  Matthew: "Mateo", Mark: "Marcos", Luke: "Lucas", John: "Juan", Acts: "Hechos",
  Romans: "Romanos", "1 Corinthians": "1 Corintios", "2 Corinthians": "2 Corintios",
  Galatians: "Gálatas", Ephesians: "Efesios", Philippians: "Filipenses",
  Colossians: "Colosenses", "1 Thessalonians": "1 Tesalonicenses",
  "2 Thessalonians": "2 Tesalonicenses", "1 Timothy": "1 Timoteo", "2 Timothy": "2 Timoteo",
  Titus: "Tito", Philemon: "Filemón", Hebrews: "Hebreos", James: "Santiago",
  "1 Peter": "1 Pedro", "2 Peter": "2 Pedro", "1 John": "1 Juan", "2 John": "2 Juan",
  "3 John": "3 Juan", Jude: "Judas", Revelation: "Apocalipsis",
};

const FR: BookMap = {
  Genesis: "Genèse", Exodus: "Exode", Leviticus: "Lévitique", Numbers: "Nombres",
  Deuteronomy: "Deutéronome", Joshua: "Josué", Judges: "Juges", Ruth: "Ruth",
  "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel", "1 Kings": "1 Rois", "2 Kings": "2 Rois",
  "1 Chronicles": "1 Chroniques", "2 Chronicles": "2 Chroniques", Ezra: "Esdras",
  Nehemiah: "Néhémie", Esther: "Esther", Job: "Job", Psalms: "Psaumes", Proverbs: "Proverbes",
  Ecclesiastes: "Ecclésiaste", "Song of Solomon": "Cantique des Cantiques", Isaiah: "Ésaïe",
  Jeremiah: "Jérémie", Lamentations: "Lamentations", Ezekiel: "Ézéchiel", Daniel: "Daniel",
  Hosea: "Osée", Joel: "Joël", Amos: "Amos", Obadiah: "Abdias", Jonah: "Jonas",
  Micah: "Michée", Nahum: "Nahum", Habakkuk: "Habacuc", Zephaniah: "Sophonie",
  Haggai: "Aggée", Zechariah: "Zacharie", Malachi: "Malachie",
  Matthew: "Matthieu", Mark: "Marc", Luke: "Luc", John: "Jean", Acts: "Actes",
  Romans: "Romains", "1 Corinthians": "1 Corinthiens", "2 Corinthians": "2 Corinthiens",
  Galatians: "Galates", Ephesians: "Éphésiens", Philippians: "Philippiens",
  Colossians: "Colossiens", "1 Thessalonians": "1 Thessaloniciens",
  "2 Thessalonians": "2 Thessaloniciens", "1 Timothy": "1 Timothée", "2 Timothy": "2 Timothée",
  Titus: "Tite", Philemon: "Philémon", Hebrews: "Hébreux", James: "Jacques",
  "1 Peter": "1 Pierre", "2 Peter": "2 Pierre", "1 John": "1 Jean", "2 John": "2 Jean",
  "3 John": "3 Jean", Jude: "Jude", Revelation: "Apocalypse",
};

const DE: BookMap = {
  Genesis: "1. Mose", Exodus: "2. Mose", Leviticus: "3. Mose", Numbers: "4. Mose",
  Deuteronomy: "5. Mose", Joshua: "Josua", Judges: "Richter", Ruth: "Rut",
  "1 Samuel": "1. Samuel", "2 Samuel": "2. Samuel", "1 Kings": "1. Könige", "2 Kings": "2. Könige",
  "1 Chronicles": "1. Chronik", "2 Chronicles": "2. Chronik", Ezra: "Esra",
  Nehemiah: "Nehemia", Esther: "Ester", Job: "Hiob", Psalms: "Psalmen", Proverbs: "Sprüche",
  Ecclesiastes: "Prediger", "Song of Solomon": "Hohelied", Isaiah: "Jesaja",
  Jeremiah: "Jeremia", Lamentations: "Klagelieder", Ezekiel: "Hesekiel", Daniel: "Daniel",
  Hosea: "Hosea", Joel: "Joel", Amos: "Amos", Obadiah: "Obadja", Jonah: "Jona",
  Micah: "Micha", Nahum: "Nahum", Habakkuk: "Habakuk", Zephaniah: "Zefanja",
  Haggai: "Haggai", Zechariah: "Sacharja", Malachi: "Maleachi",
  Matthew: "Matthäus", Mark: "Markus", Luke: "Lukas", John: "Johannes", Acts: "Apostelgeschichte",
  Romans: "Römer", "1 Corinthians": "1. Korinther", "2 Corinthians": "2. Korinther",
  Galatians: "Galater", Ephesians: "Epheser", Philippians: "Philipper",
  Colossians: "Kolosser", "1 Thessalonians": "1. Thessalonicher",
  "2 Thessalonians": "2. Thessalonicher", "1 Timothy": "1. Timotheus", "2 Timothy": "2. Timotheus",
  Titus: "Titus", Philemon: "Philemon", Hebrews: "Hebräer", James: "Jakobus",
  "1 Peter": "1. Petrus", "2 Peter": "2. Petrus", "1 John": "1. Johannes", "2 John": "2. Johannes",
  "3 John": "3. Johannes", Jude: "Judas", Revelation: "Offenbarung",
};

const ZHS: BookMap = {
  Genesis: "创世记", Exodus: "出埃及记", Leviticus: "利未记", Numbers: "民数记",
  Deuteronomy: "申命记", Joshua: "约书亚记", Judges: "士师记", Ruth: "路得记",
  "1 Samuel": "撒母耳记上", "2 Samuel": "撒母耳记下", "1 Kings": "列王纪上", "2 Kings": "列王纪下",
  "1 Chronicles": "历代志上", "2 Chronicles": "历代志下", Ezra: "以斯拉记",
  Nehemiah: "尼希米记", Esther: "以斯帖记", Job: "约伯记", Psalms: "诗篇", Proverbs: "箴言",
  Ecclesiastes: "传道书", "Song of Solomon": "雅歌", Isaiah: "以赛亚书",
  Jeremiah: "耶利米书", Lamentations: "耶利米哀歌", Ezekiel: "以西结书", Daniel: "但以理书",
  Hosea: "何西阿书", Joel: "约珥书", Amos: "阿摩司书", Obadiah: "俄巴底亚书", Jonah: "约拿书",
  Micah: "弥迦书", Nahum: "那鸿书", Habakkuk: "哈巴谷书", Zephaniah: "西番雅书",
  Haggai: "哈该书", Zechariah: "撒迦利亚书", Malachi: "玛拉基书",
  Matthew: "马太福音", Mark: "马可福音", Luke: "路加福音", John: "约翰福音", Acts: "使徒行传",
  Romans: "罗马书", "1 Corinthians": "哥林多前书", "2 Corinthians": "哥林多后书",
  Galatians: "加拉太书", Ephesians: "以弗所书", Philippians: "腓立比书",
  Colossians: "歌罗西书", "1 Thessalonians": "帖撒罗尼迦前书",
  "2 Thessalonians": "帖撒罗尼迦后书", "1 Timothy": "提摩太前书", "2 Timothy": "提摩太后书",
  Titus: "提多书", Philemon: "腓利门书", Hebrews: "希伯来书", James: "雅各书",
  "1 Peter": "彼得前书", "2 Peter": "彼得后书", "1 John": "约翰一书", "2 John": "约翰二书",
  "3 John": "约翰三书", Jude: "犹大书", Revelation: "启示录",
};

const ZHT: BookMap = {
  Genesis: "創世記", Exodus: "出埃及記", Leviticus: "利未記", Numbers: "民數記",
  Deuteronomy: "申命記", Joshua: "約書亞記", Judges: "士師記", Ruth: "路得記",
  "1 Samuel": "撒母耳記上", "2 Samuel": "撒母耳記下", "1 Kings": "列王紀上", "2 Kings": "列王紀下",
  "1 Chronicles": "歷代志上", "2 Chronicles": "歷代志下", Ezra: "以斯拉記",
  Nehemiah: "尼希米記", Esther: "以斯帖記", Job: "約伯記", Psalms: "詩篇", Proverbs: "箴言",
  Ecclesiastes: "傳道書", "Song of Solomon": "雅歌", Isaiah: "以賽亞書",
  Jeremiah: "耶利米書", Lamentations: "耶利米哀歌", Ezekiel: "以西結書", Daniel: "但以理書",
  Hosea: "何西阿書", Joel: "約珥書", Amos: "阿摩司書", Obadiah: "俄巴底亞書", Jonah: "約拿書",
  Micah: "彌迦書", Nahum: "那鴻書", Habakkuk: "哈巴谷書", Zephaniah: "西番雅書",
  Haggai: "哈該書", Zechariah: "撒迦利亞書", Malachi: "瑪拉基書",
  Matthew: "馬太福音", Mark: "馬可福音", Luke: "路加福音", John: "約翰福音", Acts: "使徒行傳",
  Romans: "羅馬書", "1 Corinthians": "哥林多前書", "2 Corinthians": "哥林多後書",
  Galatians: "加拉太書", Ephesians: "以弗所書", Philippians: "腓立比書",
  Colossians: "歌羅西書", "1 Thessalonians": "帖撒羅尼迦前書",
  "2 Thessalonians": "帖撒羅尼迦後書", "1 Timothy": "提摩太前書", "2 Timothy": "提摩太後書",
  Titus: "提多書", Philemon: "腓利門書", Hebrews: "希伯來書", James: "雅各書",
  "1 Peter": "彼得前書", "2 Peter": "彼得後書", "1 John": "約翰一書", "2 John": "約翰二書",
  "3 John": "約翰三書", Jude: "猶大書", Revelation: "啟示錄",
};

const HI: BookMap = {
  Genesis: "उत्पत्ति", Exodus: "निर्गमन", Leviticus: "लैव्यव्यवस्था", Numbers: "गिनती",
  Deuteronomy: "व्यवस्थाविवरण", Joshua: "यहोशू", Judges: "न्यायियों", Ruth: "रूत",
  "1 Samuel": "1 शमूएल", "2 Samuel": "2 शमूएल", "1 Kings": "1 राजा", "2 Kings": "2 राजा",
  "1 Chronicles": "1 इतिहास", "2 Chronicles": "2 इतिहास", Ezra: "एज्रा",
  Nehemiah: "नहेम्याह", Esther: "एस्तेर", Job: "अय्यूब", Psalms: "भजन संहिता", Proverbs: "नीतिवचन",
  Ecclesiastes: "सभोपदेशक", "Song of Solomon": "श्रेष्ठगीत", Isaiah: "यशायाह",
  Jeremiah: "यिर्मयाह", Lamentations: "विलापगीत", Ezekiel: "यहेजकेल", Daniel: "दानिय्येल",
  Hosea: "होशे", Joel: "योएल", Amos: "आमोस", Obadiah: "ओबद्याह", Jonah: "योना",
  Micah: "मीका", Nahum: "नहूम", Habakkuk: "हबक्कूक", Zephaniah: "सपन्याह",
  Haggai: "हाग्गै", Zechariah: "जकर्याह", Malachi: "मलाकी",
  Matthew: "मत्ती", Mark: "मरकुस", Luke: "लूका", John: "यूहन्ना", Acts: "प्रेरितों के काम",
  Romans: "रोमियों", "1 Corinthians": "1 कुरिन्थियों", "2 Corinthians": "2 कुरिन्थियों",
  Galatians: "गलातियों", Ephesians: "इफिसियों", Philippians: "फिलिप्पियों",
  Colossians: "कुलुस्सियों", "1 Thessalonians": "1 थिस्सलुनीकियों",
  "2 Thessalonians": "2 थिस्सलुनीकियों", "1 Timothy": "1 तीमुथियुस", "2 Timothy": "2 तीमुथियुस",
  Titus: "तीतुस", Philemon: "फिलेमोन", Hebrews: "इब्रानियों", James: "याकूब",
  "1 Peter": "1 पतरस", "2 Peter": "2 पतरस", "1 John": "1 यूहन्ना", "2 John": "2 यूहन्ना",
  "3 John": "3 यूहन्ना", Jude: "यहूदा", Revelation: "प्रकाशितवाक्य",
};

const MAPS: Partial<Record<LanguageCode, BookMap>> = {
  es: ES, fr: FR, de: DE, "zh-Hans": ZHS, "zh-Hant": ZHT, hi: HI,
};

export function localizedBookName(name: string, code: LanguageCode): string {
  return MAPS[code]?.[name] ?? name;
}
