import frenchWords from "an-array-of-french-words";

export type LetterFeedback = "correct" | "wrong-position" | "not-in-word" | "unknown";

export type WordFeedback = {
  word: string;
  feedback: LetterFeedback[];
};

type WordsDictionary = { [key: number]: string[] };

// Optimal starting words based on French letter frequency and vowel distribution
// These words prioritize common letters: E, A, R, I, S, T, N, O, L
const STARTING_WORDS: { [key: number]: string[] } = {
  4: ["AIRE", "ARTS", "OSER", "LENT", "RIEN"],
  5: ["ARISE", "SONAR", "SALON", "NOTRE", "TRAIN"],
  6: ["SOIENT", "ENTRAI", "ORNAIS", "SOLEIL", "TRAIES"],
  7: ["SENTIRA", "ENTRAIS", "ORANTES", "TRAITES", "ORNATES"],
  8: ["ENTRAINS", "ORATEURS", "TRAINEES", "ORNATES", "SENTIRAS"]
};

export class WordSelector {
  private dictionary: WordsDictionary;

  constructor() {
    this.dictionary = this.createWordsDictionary();
  }

  private createWordsDictionary(): WordsDictionary {
    const dictionary: WordsDictionary = {};

    const filteredWords = frenchWords.filter((word: string) => {
      const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const basicLettersOnly = /^[a-zA-Z]+$/;
      const hasAccents = word !== normalizedWord;

      return (
        word.length >= 4 &&
        word.length <= 8 &&
        basicLettersOnly.test(word) &&
        !hasAccents &&
        !word.includes('-') &&
        !word.includes(' ') &&
        !word.includes("'") &&
        !word.includes('.') &&
        !word.includes(',') &&
        !word.includes('_') &&
        !word.includes('ç') &&
        !word.includes('Ç')
      );
    });

    filteredWords.forEach((word: string) => {
      const length = word.length;
      if (!dictionary[length]) {
        dictionary[length] = [];
      }
      dictionary[length].push(word.toLowerCase());
    });

    return dictionary;
  }

  private filterWords(words: string[], feedbackHistory: WordFeedback[]): string[] {
    return words.filter(word => {
      for (const wordFeedback of feedbackHistory) {
        const testWord = wordFeedback.word.toLowerCase();
        const feedback = wordFeedback.feedback;

        const letterCounts = new Map<string, { correct: number; wrongPosition: number; notInWord: number }>();

        for (let i = 0; i < testWord.length; i++) {
          const letter = testWord[i];
          const letterFeedback = feedback[i];

          if (!letterCounts.has(letter)) {
            letterCounts.set(letter, { correct: 0, wrongPosition: 0, notInWord: 0 });
          }

          const counts = letterCounts.get(letter)!;
          if (letterFeedback === "correct") {
            counts.correct++;
          } else if (letterFeedback === "wrong-position") {
            counts.wrongPosition++;
          } else if (letterFeedback === "not-in-word") {
            counts.notInWord++;
          }
        }

        for (let i = 0; i < testWord.length; i++) {
          const letter = testWord[i];
          const letterFeedback = feedback[i];

          switch (letterFeedback) {
            case "correct":
              if (word[i] !== letter) {
                return false;
              }
              break;

            case "wrong-position":
              if (word[i] === letter) {
                return false;
              }
              if (!word.includes(letter)) {
                return false;
              }
              break;

            case "not-in-word":
              const counts = letterCounts.get(letter)!;
              const requiredCount = counts.correct + counts.wrongPosition;

              if (requiredCount > 0) {
                const actualCount = (word.match(new RegExp(letter, 'g')) || []).length;
                if (actualCount !== requiredCount) {
                  return false;
                }
                if (word[i] === letter) {
                  return false;
                }
              } else {
                if (word.includes(letter)) {
                  return false;
                }
              }
              break;
          }
        }

        for (const [letter, counts] of letterCounts) {
          const requiredCount = counts.correct + counts.wrongPosition;
          if (requiredCount > 0) {
            const actualCount = (word.match(new RegExp(letter, 'g')) || []).length;
            if (counts.notInWord > 0) {
              if (actualCount !== requiredCount) {
                return false;
              }
            } else {
              if (actualCount < requiredCount) {
                return false;
              }
            }
          }
        }
      }
      return true;
    });
  }

  private getStartingWord(length: number): string | null {
    const startingWords = STARTING_WORDS[length];
    if (!startingWords || startingWords.length === 0) {
      const availableWords = this.dictionary[length] || [];
      if (availableWords.length === 0) return null;
      return availableWords[Math.floor(Math.random() * availableWords.length)];
    }

    return startingWords[Math.floor(Math.random() * startingWords.length)];
  }

  public selectWord(length: number, testedWords: WordFeedback[]): string | null {
    if (testedWords.length === 0) {
      return this.getStartingWord(length);
    }

    const availableWords = this.dictionary[length] || [];
    const filteredWords = this.filterWords(availableWords, testedWords);

    if (filteredWords.length === 0) {
      return null;
    }

    return filteredWords[Math.floor(Math.random() * filteredWords.length)];
  }

  public getRemainingWordsCount(length: number, testedWords: WordFeedback[]): number {
    const availableWords = this.dictionary[length] || [];
    return this.filterWords(availableWords, testedWords).length;
  }

  public getAllWords(length: number): string[] {
    return this.dictionary[length] || [];
  }
}