import frenchWords from "an-array-of-french-words";
import type { LanguageConfig } from "./languageConfig";

// French letter frequency (accent-folded — SUTOM strips accents, so é/è/ê→e, etc.).
// Source: fr.wikipedia "Fréquence d'apparition des lettres".
const FRENCH_LETTER_FREQUENCY: { [key: string]: number } = {
  e: 14.72,
  s: 7.95,
  a: 7.64,
  i: 7.53,
  t: 7.24,
  n: 7.1,
  r: 6.69,
  u: 6.31,
  o: 5.8,
  l: 5.46,
  d: 3.67,
  c: 3.26,
  m: 2.97,
  p: 2.52,
  v: 1.84,
  q: 1.36,
  f: 1.07,
  b: 0.9,
  g: 0.87,
  h: 0.74,
  j: 0.61,
  x: 0.43,
  z: 0.33,
  y: 0.13,
  k: 0.07,
  w: 0.05,
};

// Optimal starting words based on French letter frequency and vowel distribution
// These words prioritize common letters: E, A, R, I, S, T, N, O, L
// Recognizable, high-coverage French words (accent-free) per length. Any entry not present
// in the dictionary is dropped at runtime by getStartingWord's validation.
const FRENCH_STARTING_WORDS: { [key: number]: string[] } = {
  4: ["RATE", "SALE", "TIRE", "NOIR", "RIEN", "AIRE", "OSER"],
  5: ["SAINT", "TRAIN", "SATIN", "TOILE", "REINS", "NOTRE", "SALON"],
  6: ["SALINE", "RATION", "TISANE", "ORIENT", "SATIRE", "SOLEIL", "AROSEE"],
  7: ["NOTAIRE", "RATIONS", "AILERON", "ACTIONS", "SATINER", "ORANTES"],
  8: ["NOTAIRES", "AILERONS", "ADROITES", "ORATEURS", "SENTIRAS"],
};

export const frenchConfig: LanguageConfig = {
  wordSource: frenchWords as string[],

  letterFrequency: FRENCH_LETTER_FREQUENCY,

  startingWords: FRENCH_STARTING_WORDS,

  wordFilter: {
    minLength: 4,
    maxLength: 8,
    allowAccents: false,
    excludedCharacters: ["-", " ", "'", ".", ",", "_"],
    // SUTOM accepts accent-stripped words (ÉVITER → "eviter"), so normalize accents
    // into the base letter (and cedilla ç → c) instead of rejecting them — otherwise a
    // large share of valid answers could never be suggested.
    normalizeWord: (word: string) =>
      word
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    // Runs on the already-normalized word: keep only plain a-z words.
    customFilter: (word: string) => /^[a-z]+$/.test(word),
  },

  positionScoring: {
    commonFirstLetters: ["s", "c", "p", "m", "r", "l", "t", "d"],
    commonLastLetters: ["s", "e", "r", "t", "n"],
    firstLetterBonus: 2,
    lastLetterBonus: 1.5,
  },

  ui: {
    language: "Français",
    lengthLabel: "Longueur du mot",
    suggestionLabel: "Suggestion actuelle",
    testedWordsLabel: "Mots testés",
    analysisLabel: "Analyse",
    resetLabel: "Réinitialiser",
    noSuggestionTitle: "Aucune suggestion",
    noSuggestionMessage: "Aucun mot ne correspond aux critères",
    lengthSetTitle: "Longueur définie",
    lengthSetMessage: (length: number) => `Prêt à suggérer des mots de ${length} lettres`,
    feedbackSavedTitle: "Retour enregistré",
    feedbackSavedMessage: "Prêt pour la prochaine suggestion",
    resetTitle: "Réinitialisation",
    resetMessage: "Toutes les données effacées",

    // Action labels
    setLengthAction: "Définir la longueur",
    newSuggestionAction: "Nouvelle suggestion",
    getSuggestionAction: "Obtenir suggestion",
    resetAction: "Réinitialiser",
    submitFeedbackAction: "Valider le retour",
    cancelAction: "Annuler",
    rejectWordAction: "Mot refusé par le jeu",
    saveExcludedAction: "Enregistrer les exclusions",
    clearExcludedAction: "Effacer les exclusions",

    // Additional UI labels
    tryWordLabel: "Essayez ce mot",
    testedWordCount: "mot(s) testé(s)",
    wordsRemainingLabel: "mots restants",
    eliminatedLabel: "éliminés",
    averageScoreLabel: "Score moyen",
    feedbackPrompt: "Donnez votre retour pour",
    letterLabel: "Lettre",
    correctPositionLabel: "Bonne position",
    wrongPositionLabel: "Mauvaise position",
    notInWordLabel: "Pas dans le mot",
    notSetLabel: "Non défini",
    lettersUnit: "lettres",

    excludedWordsLabel: "Mots exclus",
    excludedWordsPlaceholder: "Mots refusés par le jeu (un par ligne)",
    excludedLettersLabel: "Lettres exclues",
    excludedLettersPlaceholder: "Lettres absentes, ex. « aqz »",
    wordRejectedTitle: "Mot exclu",
    wordRejectedMessage: "Nouvelle suggestion en cours",
  },
};
