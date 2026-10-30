/*
<MODULE_CONTRACT>
<purpose>
  RFC-1450: closed-class stop-word lists for LEAK-LANG-01 — deterministic
  same-script language detection over rendered corpus segments. Each list
  holds function words (determiners, pronouns, auxiliaries, conjunctions,
  prepositions, particles) that occur constantly in real text and carry no
  lexical meaning of their own.
</purpose>
<non-goals>
  <item>No probabilistic language identification — a segment is a leak only
  when >= 2 of its words hit one other language's list and none hit the page
  language's list.</item>
  <item>No vocabulary or semantic words — function words only.</item>
</non-goals>
<key-decisions>
  <item>Every word belongs to at most one language list — words shared across
  the supported set (en/de `in`, `so`, `war`; ru/uk Cyrillic `в`, `на`, `з`;
  en/uz `men`) are dropped from both sides so detection never ties. uz `men`
  stays because English detection has enough other signal words.</item>
</key-decisions>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1450: initial — STOP_WORDS for en/de/ru/uk/uz, cross-language overlap excluded.</item>
  <item>RFC-1450: gate rendered text for locale leaks and internal identifiers (RFC-1450)</item>
</CHANGE_SUMMARY>
*/

export type StopWordLang = "en" | "de" | "ru" | "uk" | "uz";

/**
 * Function words per language. Tokens match case-insensitively after word
 * extraction (apostrophes inside words — `bo'ladi`, `don't` — are kept).
 */
export const STOP_WORDS: Readonly<Record<StopWordLang, ReadonlySet<string>>> = {
  en: new Set([
    "the", "a", "and", "or", "of", "to", "for", "with", "on", "at", "from", "by",
    "as", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "would", "can", "could", "shall", "should", "may", "might",
    "must", "this", "that", "these", "those", "it", "its", "you", "your", "we",
    "our", "they", "their", "not", "no", "but", "if", "then", "than", "such",
    "all", "any", "each", "more", "most", "other", "some", "about", "into",
    "over", "after", "before", "between", "under", "again", "out", "here",
    "there", "when", "where", "why", "how", "what", "which", "who", "whom",
  ]),
  de: new Set([
    "der", "das", "dem", "den", "ein", "eine", "einer", "einem", "einen", "und",
    "oder", "aber", "ist", "sind", "waren", "wurde", "werden", "wird", "sein",
    "seine", "haben", "habe", "kann", "konnte", "können", "muss", "müssen",
    "soll", "sollen", "darf", "dürfen", "nicht", "kein", "keine", "auch", "nur",
    "noch", "schon", "sehr", "mehr", "als", "wenn", "wie", "wo", "wer", "was",
    "hier", "dort", "dann", "jetzt", "immer", "wieder", "alle", "alles", "jede",
    "jeder", "viele", "diese", "dieser", "dieses", "nach", "vor", "bei", "mit",
    "für", "von", "zu", "auf", "über", "unter", "durch", "gegen", "ohne", "um",
    "aus", "ab", "seit", "bis", "weil", "dass", "obwohl", "damit", "sie", "er",
    "es", "wir", "ihr", "ich", "mir", "uns", "ihm", "ihn", "im", "am",
  ]),
  ru: new Set([
    "и", "что", "это", "этот", "эта", "эти", "же", "только", "ещё", "еще",
    "который", "которая", "которые", "которое", "также", "если", "когда",
    "после", "через", "будет", "был", "была", "было", "были", "есть", "их",
    "его", "её", "ее", "он", "она", "они", "оно", "как", "или", "но", "а",
    "уже", "тоже", "очень", "более", "самый", "перед", "между", "над", "под",
    "при", "из", "от", "об", "с", "по", "о", "во", "со", "все", "всё", "весь",
    "вся", "всех", "мой", "моя", "мои", "свой", "своя", "свои", "наш", "наша",
    "наши", "ваш", "ваша", "ваши", "это", "тот", "та", "те", "да", "нет",
    "нужно", "надо", "можно", "нельзя", "ли", "ведь", "вот", "там", "тут",
    "здесь", "куда", "откуда", "почему", "зачем", "сколько", "который",
    "сейчас", "потом", "сейчас", "всегда", "никогда", "иногда",
  ]),
  uk: new Set([
    "і", "та", "що", "це", "цей", "ця", "ці", "як", "є", "був", "була",
    "було", "були", "буде", "або", "але", "також", "ще", "дуже", "який",
    "яка", "які", "яке", "коли", "де", "хто", "його", "її", "їх", "вони",
    "він", "вона", "воно", "між", "після", "протягом", "проти", "серед",
    "від", "усі", "вся", "всі", "мій", "моя", "мої", "свій", "своя", "свої",
    "наш", "наша", "наші", "ваш", "ваша", "ваші", "той", "ті", "треба",
    "можна", "необхідно", "чи", "аж", "ось", "там", "тут", "туди", "звідси",
    "чому", "навіщо", "скільки", "зараз", "потім", "завжди", "ніколи",
    "іноді", "лише", "було", "має", "мають", "мав", "мала", "бути", "якщо",
    "тому", "бо", "ні", "ніби", "хоча", "щоб", "або", "ані", "же", "ж",
  ]),
  uz: new Set([
    "va", "bu", "shu", "bir", "uchun", "bilan", "ham", "yoki", "lekin",
    "emas", "juda", "faqat", "hamma", "barcha", "eng", "deb", "edi", "kabi",
    "orqali", "haqida", "ichida", "keyin", "oldin", "hozir", "hali", "yana",
    "qayta", "ega", "bor", "yo'q", "yoʻq", "kerak", "mumkin", "chunki",
    "agar", "men", "biz", "siz", "ular", "uning", "bizning", "sizning",
    "ularning", "mening", "sen", "sening", "qanday", "qayerda",
    "qachon", "nima", "kim", "nega", "qaysi", "hamda", "yoxud", "ammo",
    "biroq", "xuddi", "ana", "mana", "baribir", "shunga", "o'sha", "oʻsha",
    "bo'ldi", "bo'ladi", "bo'lib", "boʻldi", "boladi", "gʻi", "ki", "mi",
    "sizga", "menga", "unga", "bunda", "shunda", "unda",
  ]),
};

/** Locale tag → stop-word list key (base subtag; uz-Latn → uz). */
export function stopWordLangFor(locale: string): StopWordLang | null {
  const base = locale.split("-")[0]!.toLowerCase();
  return base in STOP_WORDS ? (base as StopWordLang) : null;
}
