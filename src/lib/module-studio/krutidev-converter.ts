/**
 * Production Kruti Dev / Devlys 010 / Legacy Font to Unicode Devanagari Hindi Converter.
 * Accurately handles:
 * - Chhoti 'i' matra (f) transposition over single, half and conjunct consonants
 * - Half consonants and virama/halant (D, X, P, T, R, F, U, I, C, H, E, Y, O, L, ', ", {, =)
 * - Single base consonants (d=क, x=ग, p=च, t=ज, r=त, n=द, u=न, i=प, c=ब, e=म, ;=य, j=र, y=ल, o=व, l=स, g=ह)
 * - Reph (Z) transposition (् + र moving to proper position before consonant)
 * - Rakar (ª / z / ्र) conjuncts (e.g. Mªks -> ड्रो, ç -> प्र, Ô -> द्र)
 * - Matras, nuktas, chandrabindu, and punctuation
 * - Preservation of English technical terms, words (to, of, in, is, etc.), numbers, chemical formulas
 */

const KRUTI_MULTI_MAP: [string, string][] = [
  // 3+ character vowel combos & special words
  ["vks", "ओ"],
  ["vkS", "औ"],
  ["vk", "आ"],
  [",s", "ऐ"],
  [",oa", "एवं"],
  ["bZ", "ई"],
  ["[Key", "ख्"],

  // Special ligatures & compound consonants
  ["ñ", "हृ"],
  ["ò", "ह्न"],
  ["ó", "ह्म"],
  ["ô", "ह्य"],
  ["õ", "ह्ल"],
  ["÷", "झ्"],
  ["§", "दृ"],
  ["µ", "द्ट"],
  ["¶", "ट्ट"],
  ["·", "ठ्ठ"],
  ["¸", "ड्ड"],
  ["¹", "ड्ढ"],
  ["º", "त्त"],
  ["»", "द्द"],
  ["¼", "द्ध"],
  ["½", "द्य"],
  ["¾", "द्व"],
  ["¿", "द्म"],
  ["À", "ष्ठ"],
  ["Á", "ष्ठ"],
  ["Â", "ष्ठ"],
  ["Ã", "ष्र"],
  ["Ä", "क्ष्"],
  ["Å", "ऊ"],
  ["Æ", "क्क"],
  ["Ç", "क्त"],
  ["È", "फ्"],
  ["É", "फ"],
  ["Ê", "झ्र"],
  ["Ë", "ठ्र"],
  ["Ì", "ड्र"],
  ["Í", "ड्र"],
  ["Î", "ट्र"],
  ["Ï", "ढ्र"],
  ["Ð", "ह्र"],
  ["Ñ", "ह्र"],
  ["Ò", "ह्र"],
  ["Ó", "ह्न"],
  ["Ô", "द्र"],
  ["Õ", "द्र"],
  ["Ö", "ध्र"],
  ["×", "प्र"],
  ["Ø", "क्र"],
  ["Ù", "क्र"],
  ["Ú", "क्र"],
  ["Û", "स्त्र"],
  ["Ü", "स्त्र"],
  ["Ý", "स्र"],
  ["Þ", "ह्र"],
  ["ß", "द्य"],
  ["à", "श्र"],
  ["á", "श्र"],
  ["â", "ष्ट"],
  ["ã", "ष्ट"],
  ["ä", "ष्ठ"],
  ["å", "ष्ट"],
  ["æ", "क्क"],
  ["ç", "प्र"],
  ["è", "ह्न"],
  ["é", "ह्म"],
  ["ê", "ह्य"],
  ["ë", "ह्ल"],
  ["ì", "ह्व"],
  ["í", "ह्व"],
  ["î", "हृ"],
  ["ï", "ह्र"],
  ["ð", "ह्र"],

  // 2-character consonants & ligatures
  ["[k", "ख"],
  ["?k", "घ"],
  [">k", "झ"],
  [".k", "ण"],
  ["Fk", "थ"],
  ["/k", "ध"],
  ["Hk", "भ"],
  ["'k", "श"],
  ['"k', "ष"],
  ["{k", "क्ष"],
  ["=k", "त्र"],
  ["Kk", "ज्ञा"],
  ["kS", "ौ"],
  ["ks", "ो"],
  ["M+", "ड़"],
  ["<+", "ढ़"],
];

const KRUTI_SINGLE_MAP: [string, string][] = [
  // Half consonants
  ["D", "क्"],
  ["[", "ख्"],
  ["X", "ग्"],
  ["?", "घ्"],
  ["P", "च्"],
  ["T", "ज्"],
  [">", "झ्"],
  ["F", "थ्"],
  ["/", "ध्"],
  ["U", "न्"],
  ["I", "प्"],
  ["C", "ब्"],
  ["H", "भ्"],
  ["E", "म्"],
  ["Y", "ल्"],
  ["O", "व्"],
  ["'", "श्"],
  ['"', "ष्"],
  ["L", "स्"],
  ["{", "क्ष्"],
  ["=", "त्र्"],

  // Full consonants
  ["d", "क"],
  ["x", "ग"],
  ["³", "ङ"],
  ["p", "च"],
  ["N", "छ"],
  ["t", "ज"],
  ["¥", "ञ"],
  ["V", "ट"],
  ["B", "ठ"],
  ["M", "ड"],
  ["<", "ढ"],
  ["r", "त"],
  ["R", "त्"],
  ["n", "द"],
  ["u", "न"],
  ["i", "प"],
  ["Q", "फ"],
  ["c", "ब"],
  ["e", "म"],
  [";", "य"],
  ["j", "र"],
  ["y", "ल"],
  ["o", "व"],
  ["l", "स"],
  ["g", "ह"],
  ["K", "ज्ञ"],
  ["J", "श्र"],
  [")", "द्ध"],
  ["!", "द्द"],

  // Independent Vowels
  ["v", "अ"],
  ["b", "इ"],
  ["m", "उ"],
  ["Å", "ऊ"],
  ["_", "ऋ"],
  [",", "ए"],

  // Matras & Punctuation
  ["k", "ा"],
  ["h", "ी"],
  ["q", "ु"],
  ["w", "ू"],
  ["`", "ृ"],
  ["s", "े"],
  ["S", "ै"],
  ["a", "ं"],
  ["¡", "ँ"],
  ["%", "ः"],
  ["~", "्"],
  ["+", "़"],
  ["A", "।"],
  ["ª", "्र"],
  ["z", "्र"],
];

const COMMON_ENGLISH_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for", "with", "about",
  "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from",
  "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did",
  "doing", "some", "basic", "principles", "techniques", "classification", "nomenclature", "isomerism",
  "general", "organic", "chemistry", "hydrocarbons", "purification", "characterisation", "compounds",
  "easy", "learn", "subrule", "ex", "booster", "section", "option", "question", "topic", "contents",
  "chapter", "module", "medium", "class", "division", "neet", "jee", "ncert", "cbse", "iupac"
]);

/**
 * Converts a string or whole page text containing Kruti Dev font encoding
 * into clean standard Unicode Devanagari Hindi.
 */
export function convertKrutiDevToUnicode(text: string): string {
  if (!text || typeof text !== "string") return "";

  return text
    .split(/\r?\n/)
    .map((line) => convertKrutiDevLine(line))
    .join("\n");
}

function convertKrutiDevLine(line: string): string {
  if (!line.trim()) return line;

  // Protect parenthesized English phrases like "( Some Basic Principles and Techniques Classification & Nomenclature )"
  const preservedTokens: string[] = [];
  let protectedLine = line.replace(/\(([^()]*)\)/g, (_match, inner) => {
    const isEnglishOrMath = /^[A-Za-z0-9\s\.\,\-\+\=\/\:\&]+$/.test(inner.trim());
    if (isEnglishOrMath) {
      const idx = preservedTokens.length;
      preservedTokens.push(`(${inner})`);
      return `___PRESERVED_TOKEN_${idx}___`;
    }
    return `(${inner})`;
  });

  // Protect chemistry formulas and standalone English terms
  protectedLine = protectedLine.replace(/\b[A-Za-z0-9]+(?:[\-\=\#][A-Za-z0-9]+)+\b/g, (match) => {
    const idx = preservedTokens.length;
    preservedTokens.push(match);
    return `___PRESERVED_TOKEN_${idx}___`;
  });

  // Convert tokens
  const convertedWords = protectedLine.split(/(\s+)/).map((token) => {
    if (!token.trim() || token.startsWith("___PRESERVED_TOKEN_")) {
      return token;
    }
    const cleanWord = token.toLowerCase().replace(/[^a-z]/g, "");
    if (COMMON_ENGLISH_WORDS.has(cleanWord)) {
      return token;
    }
    return convertKrutiToken(token);
  });

  let result = convertedWords.join("");

  // Restore preserved tokens
  for (let i = 0; i < preservedTokens.length; i++) {
    result = result.split(`___PRESERVED_TOKEN_${i}___`).join(preservedTokens[i]!);
  }

  return result;
}

/**
 * Detects if a text block contains Kruti Dev font artifacts.
 */
export function isKrutiDevEncoded(text: string): boolean {
  if (!text || text.length < 3) return false;
  const krutiPatterns = [
    /vk\/kkj/i,      // आधार
    /fl\)k/i,        // सिद्धा
    /oxhZ/i,         // वर्गी
    /ukedj/i,        // नामकर
    /dkcZu/i,        // कार्बन
    /jlk;u/i,        // रसायन
    /foKku/i,        // विज्ञान
    /gkbMª/i,        // हाइड्रो
    /\bfu;e\b/i,     // नियम
    /\blcls\b/i,     // सबसे
    /\byach\b/i,     // लंबी
    /\bewy\b/i,      // मूल
    /J`a\[k/i,       // श्रृंखला
    /\bp;u\b/i,      // चयन
    /\bç\.kkyh\b/i,   // प्रणाली
    /\bleko;ork\b/i, // समावयवता
    /foHkkx/i,       // विभाग
    /f'k{kk/i,       // शिक्षा
    /mÙkj/i,         // उत्तर
    /ç'u/i,          // प्रश्न
    /[d-z]Z[a-z]/,   // Reph pattern (e.g. cZu, xhZ)
    /f[d-z]/,        // Chhoti ee matra preceding consonant
  ];

  return krutiPatterns.some((pattern) => pattern.test(text));
}

function convertKrutiToken(input: string): string {
  let str = input;

  // 1. Pre-process Reph 'Z' (moves before the preceding consonant cluster in Unicode)
  // In Kruti Dev: consonant + 'Z' -> र् + consonant
  str = str.replace(/([\[\?PF\/UI CHEOL'"{=]?[\/k|\[k|\?k|>k|\.k|Fk|Hk|'k|"k|{k|=k|Kk|M\+|<\+|d|x|p|N|t|V|B|M|<|r|R|n|u|i|Q|c|e|;|j|y|o|l|g|K|J|\)|\!][k|h|q|w|`|s|S|a|¡|\%|\+|ª|z]*)(Z)/g, "र्$1");

  // 2. Pre-process Chhoti 'i' matra 'f' (moves after consonant / conjunct in Unicode)
  str = str.replace(/f([DXYPTRFUI CHEOL'"{=]*[\/k|\[k|\?k|>k|\.k|Fk|Hk|'k|"k|{k|=k|Kk|M\+|<\+|d|x|p|N|t|V|B|M|<|r|R|n|u|i|Q|c|e|;|j|y|o|l|g|K|J|\)\!][k|h|q|w|`|s|S|a|¡|\%|\+|ª|z]*)/g, "$1f");

  // 3. Multi-character mapping
  for (const [kruti, unicode] of KRUTI_MULTI_MAP) {
    if (str.includes(kruti)) {
      str = str.split(kruti).join(unicode);
    }
  }

  // 4. Single-character mapping
  for (const [kruti, unicode] of KRUTI_SINGLE_MAP) {
    if (str.includes(kruti)) {
      str = str.split(kruti).join(unicode);
    }
  }

  // 5. Transform 'f' to Unicode Chhoti 'i' matra 'ि'
  str = str.replace(/f/g, "ि");

  return str;
}
