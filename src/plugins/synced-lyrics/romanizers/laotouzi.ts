/*
 * Hangul romanizer – McCune-Reischauer with sound changes ("Han'gŭl").
 *
 * Vendored from https://github.com/AARP41298/laotouzi2 (romanizer.js,
 * commit 7d65593c), converted to a typed ES module. Keep it in sync with
 * that repository rather than editing the rules here.
 *
 * Clean re-implementation of the second converter of laotouzi.de/conv
 * ("copyright lexilogos.com, McCune-Reischauer angepasst von laotouzi").
 * It romanizes lyrics the way they are sung (맛있다 → masitta,
 * 한국말 → han'gungmal) and only touches Hangul: Latin letters, digits,
 * emoji, punctuation, Hanja etc. are returned untouched.
 */

type Rule = (initial: number) => string;

// ---------------------------------------------------------------- tables
// Initial consonants (choseong) in Unicode order.
const I = {
  G: 0,
  GG: 1,
  N: 2,
  D: 3,
  DD: 4,
  R: 5,
  M: 6,
  B: 7,
  BB: 8,
  S: 9,
  SS: 10,
  NG: 11,
  J: 12,
  JJ: 13,
  CH: 14,
  K: 15,
  T: 16,
  P: 17,
  H: 18,
} as const;
// Word-initial / after-obstruent spelling of each initial.
const ONSET = [
  'k',
  'kk',
  'n',
  't',
  'tt',
  'r',
  'm',
  'p',
  'pp',
  's',
  'ss',
  '',
  'ch',
  'tch',
  "ch'",
  "k'",
  "t'",
  "p'",
  'h',
];
// Plain stops become voiced between voiced sounds (vowel, n, l, m, ng).
const VOICED: Record<number, string> = { 0: 'g', 3: 'd', 7: 'b', 12: 'j' };

const VOWEL = [
  'a',
  'ae',
  'ya',
  'yae',
  'ŏ',
  'e',
  'yŏ',
  'ye',
  'o',
  'wa',
  'wae',
  'oe',
  'yo',
  'u',
  'wŏ',
  'we',
  'wi',
  'yu',
  'ŭ',
  'ŭi',
  'i',
];
const V_I = 20,
  V_YEO = 6;

// Finals (jongseong) in Unicode order; index 0 = no final.
const F = {
  NONE: 0,
  G: 1,
  GG: 2,
  GS: 3,
  N: 4,
  NJ: 5,
  NH: 6,
  D: 7,
  L: 8,
  LG: 9,
  LM: 10,
  LB: 11,
  LS: 12,
  LT: 13,
  LP: 14,
  LH: 15,
  M: 16,
  B: 17,
  BS: 18,
  S: 19,
  SS: 20,
  NG: 21,
  J: 22,
  CH: 23,
  K: 24,
  T: 25,
  P: 26,
  H: 27,
} as const;

// Final at the end of a word (before space, punctuation, non-Hangul, end).
// prettier-ignore
const FINAL_END = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

// Final carried over to a following vowel (liaison).
// prettier-ignore
const LIAISON = ['', 'g', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'r', 'lg', 'lm', 'lb', 'ls', "lt'", "lp'", 'rh', 'm', 'b', 'ps', 's', 'ss', 'ng', 'j', "ch'", "k'", "t'", "p'", 'h'];

// ------------------------------------------------- final + consonant rules
// Each rule receives the next initial and returns coda + onset.
const kClass: Rule = (i) => {
  if (i === I.N || i === I.M) return 'ng' + ONSET[i];
  if (i === I.R) return 'ngn';
  if (i === I.G || i === I.GG) return 'kk';
  if (i === I.K) return "kk'";
  if (i === I.H) return 'kh';
  return 'k' + ONSET[i];
};
const tClass: Rule = (i) => {
  if (i === I.N || i === I.R) return 'nn';
  if (i === I.M) return 'nm';
  if (i === I.D || i === I.DD) return 'tt';
  if (i === I.S || i === I.SS) return 'ss';
  if (i === I.J || i === I.JJ) return 'tch';
  if (i === I.CH) return "tch'";
  if (i === I.T) return "tt'";
  if (i === I.H) return "t'";
  return 't' + ONSET[i];
};
const pClass: Rule = (i) => {
  if (i === I.N || i === I.R) return 'mn';
  if (i === I.M) return 'mm';
  if (i === I.B || i === I.BB) return 'pp';
  if (i === I.P) return "pp'";
  if (i === I.H) return 'ph';
  return 'p' + ONSET[i];
};
// Sonorant final followed by a consonant: voicing, ㄴ/ㄹ assimilation.
const sonorant =
  (coda: string, overR: string, overN?: string): Rule =>
  (i) => {
    if (i === I.R) return overR;
    if (i === I.N && overN) return overN;
    if (i === I.H) return coda === 'l' ? 'rh' : coda + 'h';
    if (VOICED[i] !== undefined)
      return (coda === 'n' && i === I.G ? "n'" : coda) + VOICED[i];
    return coda + ONSET[i];
  };
// Consonant clusters that are always verb/adjective stems: the next
// ㄱㄷㅂㅅㅈ becomes tense (앉다 → antta, 넓고 → nŏlkko).
const TENSE: Record<number, string> = {
  0: 'kk',
  3: 'tt',
  7: 'pp',
  9: 'ss',
  12: 'tch',
};
const tenseAfter =
  (coda: string, extra?: Record<number, string>): Rule =>
  (i) => {
    if (extra && extra[i] !== undefined) return extra[i];
    if (TENSE[i] !== undefined) return coda + TENSE[i];
    return coda + ONSET[i];
  };
// ㅎ (and ㅎ clusters) aspirate the next ㄱㄷㅈㅂ.
const ASP: Record<number, string> = { 0: "k'", 3: "t'", 12: "ch'", 7: "p'" };
const hFinal =
  (coda: string): Rule =>
  (i) => {
    if (ASP[i] !== undefined) return coda + ASP[i];
    if (i === I.S) return coda + 'ss';
    if (i === I.N) return coda ? (coda === 'l' ? 'll' : 'nn') : 'nn';
    if (i === I.R) return coda ? 'll' : 'r';
    if (i === I.H) return coda === 'l' ? 'rh' : coda + 'h';
    return coda + ONSET[i];
  };

const BEFORE_CONSONANT: Rule[] = [];
BEFORE_CONSONANT[F.NONE] = (i) =>
  VOICED[i] !== undefined ? VOICED[i] : ONSET[i];
BEFORE_CONSONANT[F.G] =
  BEFORE_CONSONANT[F.GG] =
  BEFORE_CONSONANT[F.K] =
  BEFORE_CONSONANT[F.GS] =
    kClass;
// 읽고 ilkko, 밝히다 palk'ida
BEFORE_CONSONANT[F.LG] = (i) =>
  i === I.G || i === I.GG ? 'lkk' : i === I.H ? "lk'" : kClass(i);
BEFORE_CONSONANT[F.D] =
  BEFORE_CONSONANT[F.S] =
  BEFORE_CONSONANT[F.SS] =
  BEFORE_CONSONANT[F.T] =
    tClass;
// 맞히다 mach'ida
BEFORE_CONSONANT[F.J] = BEFORE_CONSONANT[F.CH] = (i) =>
  i === I.H ? "ch'" : tClass(i);
BEFORE_CONSONANT[F.B] =
  BEFORE_CONSONANT[F.P] =
  BEFORE_CONSONANT[F.BS] =
  BEFORE_CONSONANT[F.LP] =
    pClass;
BEFORE_CONSONANT[F.N] = sonorant('n', 'll');
BEFORE_CONSONANT[F.L] = (i) =>
  i === I.S ? 'lss' : sonorant('l', 'll', 'll')(i);
BEFORE_CONSONANT[F.M] = sonorant('m', 'mn');
BEFORE_CONSONANT[F.NG] = sonorant('ng', 'ngn');
BEFORE_CONSONANT[F.NJ] = tenseAfter('n', {
  [I.N]: 'nn',
  [I.R]: 'll',
  [I.H]: "nch'",
});
BEFORE_CONSONANT[F.LM] = tenseAfter('m', { [I.R]: 'mn', [I.H]: 'mh' });
BEFORE_CONSONANT[F.LB] = tenseAfter('l', {
  [I.N]: 'll',
  [I.R]: 'll',
  [I.H]: "lp'",
});
BEFORE_CONSONANT[F.LS] = tenseAfter('l', {
  [I.N]: 'll',
  [I.R]: 'll',
  [I.H]: 'rh',
});
BEFORE_CONSONANT[F.LT] = tenseAfter('l', {
  [I.N]: 'll',
  [I.R]: 'll',
  [I.H]: "lt'",
});
BEFORE_CONSONANT[F.NH] = hFinal('n');
BEFORE_CONSONANT[F.LH] = hFinal('l');
BEFORE_CONSONANT[F.H] = hFinal('');

// ------------------------------------------------------------ syllables
const SBASE = 0xac00;
const split = (ch: string): [number, number, number] => {
  const n = ch.charCodeAt(0) - SBASE;
  return [Math.floor(n / 588), Math.floor((n % 588) / 28), n % 28];
};

// Words whose ㄼ is pronounced ㅂ before a consonant (밟다 → papta).
const LB_AS_P = new Set(['밟']);

/** Junction between the previous syllable's final and this syllable's initial. */
const junction = (
  prevChar: string | null,
  prevFinal: number,
  i: number,
  v: number,
): string => {
  if (prevFinal === F.NONE) return BEFORE_CONSONANT[F.NONE](i);
  if (i === I.NG) {
    // Palatalization: 굳이 kuji, 같이 kach'i, 붙여 puch'yŏ, 핥이 halch'i
    if (prevFinal === F.D && v === V_I) return 'j';
    if (prevFinal === F.T && (v === V_I || v === V_YEO)) return "ch'";
    if (prevFinal === F.LT && (v === V_I || v === V_YEO)) return "lch'";
    return LIAISON[prevFinal];
  }
  // 굳히다, 닫혀
  if (
    i === I.H &&
    (prevFinal === F.D || prevFinal === F.T) &&
    (v === V_I || v === V_YEO)
  )
    return "ch'";
  if (prevFinal === F.LB && prevChar && LB_AS_P.has(prevChar)) return pClass(i);
  return BEFORE_CONSONANT[prevFinal](i);
};

/** Romanizes a run of consecutive Hangul syllables (one word). */
export const romanizeWord = (word: string): string => {
  let out = '';
  let prevChar: string | null = null;
  let prevFinal = -1;
  for (const ch of word) {
    const [i, v, f] = split(ch);
    out +=
      (prevFinal < 0 ? ONSET[i] : junction(prevChar, prevFinal, i, v)) +
      VOWEL[v];
    prevChar = ch;
    prevFinal = f;
  }
  if (prevFinal >= 0) {
    out +=
      prevFinal === F.LB && prevChar && LB_AS_P.has(prevChar)
        ? 'p'
        : FINAL_END[prevFinal];
  }
  return out;
};

// Standalone compatibility jamo (ㄱ U+3131 … ㅣ U+3163), e.g. ㅋㅋ, ㅠㅠ.
// prettier-ignore
const JAMO: Record<string, string> = {
  'ㄱ': 'k', 'ㄲ': 'kk', 'ㄳ': 'ks', 'ㄴ': 'n', 'ㄵ': 'nj', 'ㄶ': 'nh', 'ㄷ': 't', 'ㄸ': 'tt', 'ㄹ': 'l',
  'ㄺ': 'lg', 'ㄻ': 'lm', 'ㄼ': 'lb', 'ㄽ': 'ls', 'ㄾ': 'lt', 'ㄿ': 'lp', 'ㅀ': 'lh', 'ㅁ': 'm', 'ㅂ': 'p',
  'ㅃ': 'pp', 'ㅄ': 'ps', 'ㅅ': 's', 'ㅆ': 'ss', 'ㅇ': 'ng', 'ㅈ': 'ch', 'ㅉ': 'tch', 'ㅊ': 'ch', 'ㅋ': 'k',
  'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
  'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'ŏ', 'ㅔ': 'e', 'ㅕ': 'yŏ', 'ㅖ': 'ye', 'ㅗ': 'o',
  'ㅘ': 'wa', 'ㅙ': 'wae', 'ㅚ': 'oe', 'ㅛ': 'yo', 'ㅜ': 'u', 'ㅝ': 'wŏ', 'ㅞ': 'we', 'ㅟ': 'wi', 'ㅠ': 'yu',
  'ㅡ': 'ŭ', 'ㅢ': 'ŭi', 'ㅣ': 'i',
};

const HANGUL_RUN = /[가-힣]+|[ㄱ-ㅣ]/g;
const HAS_HANGUL = /[가-힣ㄱ-ㅣᄀ-ᇿꥠ-꥿ힰ-퟿]/;

/** Romanizes every Hangul word in `text`; everything else is kept as is. */
export const romanize = (text: string): string => {
  if (!text || !HAS_HANGUL.test(text)) return text;
  // Decomposed jamo (U+1100…) are recomposed into syllables first.
  return text
    .normalize('NFC')
    .replace(HANGUL_RUN, (run) => JAMO[run] ?? romanizeWord(run));
};
