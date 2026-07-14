// English words package (similar structure to the French package)
// Installed with: npm install an-array-of-english-words

import englishWords from "an-array-of-english-words";
import type { LanguageConfig } from "./languageConfig";

// English letter frequency by DICTIONARY word-membership (better for a word guesser than
// prose ETAOIN — S and I rank higher). Source: Wikipedia "Letter frequency".
const ENGLISH_LETTER_FREQUENCY: { [key: string]: number } = {
  e: 11.0,
  s: 8.7,
  i: 8.6,
  a: 7.8,
  r: 7.3,
  n: 7.2,
  t: 6.7,
  o: 6.1,
  l: 5.3,
  c: 4.0,
  d: 3.8,
  u: 3.3,
  g: 3.0,
  p: 2.8,
  m: 2.7,
  h: 2.3,
  b: 2.0,
  y: 1.6,
  f: 1.4,
  v: 1.0,
  k: 0.97,
  w: 0.91,
  z: 0.44,
  x: 0.27,
  j: 0.25,
  q: 0.19,
};

// Recognizable, high letter-coverage opening words per length (information-theory picks:
// 3Blue1Brown, Norvig). Any entry not present in the dictionary is dropped at runtime.
const ENGLISH_STARTING_WORDS: { [key: number]: string[] } = {
  4: ["RATE", "TALE", "LANE", "TEAR", "ROSE"],
  5: ["SLATE", "CRANE", "CRATE", "TRACE", "STARE", "RAISE", "ARISE"],
  6: ["SENIOR", "ORIENT", "RETAIL", "TAILOR", "RATIOS", "REASON"],
  7: ["RETINAS", "ANTLERS", "SALTINE", "ORIENTS", "NASTIER"],
  8: ["NOTARIES", "ORIENTAL", "LATRINES", "SENORITA", "TAILORED"],
};

export const englishConfig: LanguageConfig = {
  wordSource: englishWords as string[],

  letterFrequency: ENGLISH_LETTER_FREQUENCY,

  startingWords: ENGLISH_STARTING_WORDS,

  wordFilter: {
    minLength: 4,
    maxLength: 8,
    allowAccents: false,
    excludedCharacters: ["-", " ", "'", ".", ",", "_"],
    customFilter: (word: string) => {
      const basicLettersOnly = /^[a-zA-Z]+$/;
      return basicLettersOnly.test(word);
    },
  },

  positionScoring: {
    commonFirstLetters: ["t", "a", "s", "c", "p", "b", "d", "o", "m", "f"],
    commonLastLetters: ["e", "s", "d", "t", "n", "r", "y"],
    firstLetterBonus: 2,
    lastLetterBonus: 1.5,
  },

  ui: {
    language: "English",
    lengthLabel: "Word length",
    suggestionLabel: "Current suggestion",
    testedWordsLabel: "Tested words",
    analysisLabel: "Analysis",
    resetLabel: "Reset",
    noSuggestionTitle: "No suggestion",
    noSuggestionMessage: "No words match the criteria",
    lengthSetTitle: "Length set",
    lengthSetMessage: (length: number) => `Ready to suggest ${length}-letter words`,
    feedbackSavedTitle: "Feedback saved",
    feedbackSavedMessage: "Ready for next suggestion",
    resetTitle: "Reset",
    resetMessage: "All data cleared",

    // Action labels
    setLengthAction: "Set Length",
    newSuggestionAction: "New Suggestion",
    getSuggestionAction: "Get Suggestion",
    resetAction: "Reset",
    submitFeedbackAction: "Submit Feedback",
    cancelAction: "Cancel",
    rejectWordAction: "Word Rejected by Game",
    saveExcludedAction: "Save Exclusions",
    clearExcludedAction: "Clear Exclusions",

    // Additional UI labels
    tryWordLabel: "Try this word",
    testedWordCount: "word(s) tested",
    wordsRemainingLabel: "words remaining",
    eliminatedLabel: "eliminated",
    averageScoreLabel: "Average score",
    feedbackPrompt: "Give feedback for",
    letterLabel: "Letter",
    correctPositionLabel: "Correct position",
    wrongPositionLabel: "Wrong position",
    notInWordLabel: "Not in word",
    notSetLabel: "Not set",
    lettersUnit: "letters",

    excludedWordsLabel: "Excluded words",
    excludedWordsPlaceholder: "Words the game rejects (one per line)",
    excludedLettersLabel: "Excluded letters",
    excludedLettersPlaceholder: 'Letters not in the word, e.g. "aqz"',
    wordRejectedTitle: "Word excluded",
    wordRejectedMessage: "Finding a new suggestion",
  },
};
