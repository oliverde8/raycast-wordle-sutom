import { WordScorer, type WordScore } from "./wordScorer";
import type { LanguageConfig } from "./languageConfig";

export type LetterFeedback = "correct" | "wrong-position" | "not-in-word" | "unknown";

export type WordFeedback = {
  word: string;
  feedback: LetterFeedback[];
};

// User-provided constraints independent of the tested-word feedback: whole words the game
// rejects as non-existent, and letters known to be absent (e.g. tips from a friend).
export type Exclusions = { words?: string[]; letters?: string[] };

type ExclusionSets = { words: Set<string>; letters: Set<string> };

type WordsDictionary = { [key: number]: string[] };

export class WordSelector {
  private dictionary: WordsDictionary;
  private cache: Map<string, string[]> = new Map();
  private openerCache: Map<number, string[]> = new Map();
  private readonly MAX_CANDIDATES_FOR_ANALYSIS = 400;
  private readonly OPENER_POOL_SIZE = 20;
  private config: LanguageConfig;
  private wordScorer: WordScorer;

  constructor(config: LanguageConfig) {
    this.config = config;
    this.wordScorer = new WordScorer(config);
    this.dictionary = this.createWordsDictionary();
  }

  private createWordsDictionary(): WordsDictionary {
    const { wordSource, wordFilter } = this.config;
    const sourceWords = typeof wordSource === "function" ? wordSource() : wordSource;
    const normalizeWord = wordFilter.normalizeWord ?? ((w: string) => w.toLowerCase());

    // Bucket by length using Sets — normalization (e.g. accent stripping) collapses several
    // raw words to the same in-game form, so dedup is required.
    const buckets: { [key: number]: Set<string> } = {};

    for (const raw of sourceWords) {
      // Reject punctuation / formatting characters on the raw word.
      if (wordFilter.excludedCharacters.some((char) => raw.includes(char))) {
        continue;
      }

      const word = normalizeWord(raw);

      // Length is checked on the normalized form (accent stripping does not change length,
      // but the check must reflect the word actually stored).
      if (word.length < wordFilter.minLength || word.length > wordFilter.maxLength) {
        continue;
      }

      // Custom filter validates the normalized word.
      if (wordFilter.customFilter && !wordFilter.customFilter(word)) {
        continue;
      }

      if (!buckets[word.length]) {
        buckets[word.length] = new Set();
      }
      buckets[word.length].add(word);
    }

    const dictionary: WordsDictionary = {};
    for (const length of Object.keys(buckets)) {
      dictionary[Number(length)] = [...buckets[Number(length)]];
    }
    return dictionary;
  }

  private filterWords(words: string[], feedbackHistory: WordFeedback[]): string[] {
    if (feedbackHistory.length === 0) return words;

    return words.filter((word) => {
      // Pre-compute word character array for faster access
      const wordChars = word.split("");

      for (const wordFeedback of feedbackHistory) {
        if (!this.wordMatchesFeedback(wordChars, wordFeedback)) {
          return false;
        }
      }
      return true;
    });
  }

  private wordMatchesFeedback(wordChars: string[], wordFeedback: WordFeedback): boolean {
    const testWord = wordFeedback.word.toLowerCase();
    const feedback = wordFeedback.feedback;
    const testChars = testWord.split("");

    // Pre-compute letter constraints
    const letterConstraints = this.buildLetterConstraints(testChars, feedback);

    // Quick reject: check fixed positions first
    for (let i = 0; i < testChars.length; i++) {
      if (feedback[i] === "correct" && wordChars[i] !== testChars[i]) {
        return false;
      }
      if (feedback[i] === "wrong-position" && wordChars[i] === testChars[i]) {
        return false;
      }
    }

    // Check letter count constraints
    const wordLetterCounts = this.countLetters(wordChars);

    for (const [letter, constraints] of letterConstraints) {
      const actualCount = wordLetterCounts.get(letter) || 0;

      if (constraints.exactCount !== undefined) {
        if (actualCount !== constraints.exactCount) return false;
      } else {
        if (actualCount < constraints.minCount) return false;
        if (constraints.maxCount !== undefined && actualCount > constraints.maxCount) return false;
      }

      // Check wrong position constraints
      if (constraints.forbiddenPositions.size > 0) {
        for (let pos = 0; pos < wordChars.length; pos++) {
          if (wordChars[pos] === letter && constraints.forbiddenPositions.has(pos)) {
            return false;
          }
        }
      }

      // Check required presence for wrong-position letters
      if (constraints.mustBePresent && actualCount === 0) {
        return false;
      }
    }

    return true;
  }

  private buildLetterConstraints(testChars: string[], feedback: LetterFeedback[]) {
    const constraints = new Map<
      string,
      {
        minCount: number;
        maxCount?: number;
        exactCount?: number;
        forbiddenPositions: Set<number>;
        mustBePresent: boolean;
      }
    >();

    // Count feedback types per letter
    const feedbackCounts = new Map<string, { correct: number; wrongPosition: number; notInWord: number }>();

    for (let i = 0; i < testChars.length; i++) {
      const letter = testChars[i];
      const fb = feedback[i];

      if (!feedbackCounts.has(letter)) {
        feedbackCounts.set(letter, { correct: 0, wrongPosition: 0, notInWord: 0 });
      }

      const counts = feedbackCounts.get(letter)!;
      if (fb === "correct") counts.correct++;
      else if (fb === "wrong-position") counts.wrongPosition++;
      else if (fb === "not-in-word") counts.notInWord++;
    }

    // Build constraints
    for (const [letter, counts] of feedbackCounts) {
      const constraint: {
        minCount: number;
        maxCount?: number;
        exactCount?: number;
        forbiddenPositions: Set<number>;
        mustBePresent: boolean;
      } = {
        minCount: counts.correct + counts.wrongPosition,
        forbiddenPositions: new Set<number>(),
        mustBePresent: counts.correct > 0 || counts.wrongPosition > 0,
      };

      // If we have "not-in-word" feedback, this gives us exact count
      if (counts.notInWord > 0) {
        constraint.exactCount = counts.correct + counts.wrongPosition;
      }

      // Mark forbidden positions for wrong-position letters
      for (let i = 0; i < testChars.length; i++) {
        if (testChars[i] === letter && feedback[i] === "wrong-position") {
          constraint.forbiddenPositions.add(i);
        }
      }

      constraints.set(letter, constraint);
    }

    return constraints;
  }

  private countLetters(chars: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const char of chars) {
      counts.set(char, (counts.get(char) || 0) + 1);
    }
    return counts;
  }

  // Normalize to the dictionary's storage form (accent-free lowercase — SUTOM strips accents).
  private normalize(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private buildExclusionSets(exclusions: Exclusions): ExclusionSets {
    const words = new Set((exclusions.words || []).map((w) => this.normalize(w.trim())).filter((w) => w.length > 0));
    const letters = new Set<string>();
    for (const chunk of exclusions.letters || []) {
      for (const ch of this.normalize(chunk)) {
        if (ch >= "a" && ch <= "z") letters.add(ch);
      }
    }
    return { words, letters };
  }

  // A dictionary word is excluded if it is a rejected word, or contains any absent letter.
  private isExcluded(word: string, ex: ExclusionSets): boolean {
    if (ex.words.has(word)) return true;
    if (ex.letters.size > 0) {
      for (const ch of word) {
        if (ex.letters.has(ch)) return true;
      }
    }
    return false;
  }

  // Top opening words ranked by letter frequency + position (cheap, data-driven per language).
  // The ranked list is dictionary-derived so it is cached once; exclusions are applied after.
  private getRankedOpeners(length: number, ex: ExclusionSets): string[] {
    if (!this.openerCache.has(length)) {
      const ranked = (this.dictionary[length] || [])
        .map((word) => ({
          word,
          score: this.wordScorer.calculateFrequencyScore(word) + this.wordScorer.calculatePositionScore(word),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, this.OPENER_POOL_SIZE)
        .map((s) => s.word);
      this.openerCache.set(length, ranked);
    }
    return this.openerCache.get(length)!.filter((word) => !this.isExcluded(word, ex));
  }

  private getStartingWord(length: number, ex: ExclusionSets): string | null {
    const availableWords = (this.dictionary[length] || []).filter((word) => !this.isExcluded(word, ex));
    if (availableWords.length === 0) return null;

    // Prefer curated starting words that are the right length, exist in the dictionary and are
    // not excluded (drops typos, wrong-length or rejected entries). Fall back to the
    // frequency-ranked openers, then to any available word.
    const dictionaryWords = new Set(this.dictionary[length] || []);
    const validStartingWords = [
      ...new Set((this.config.startingWords[length] || []).map((w) => w.toLowerCase())),
    ].filter((word) => word.length === length && dictionaryWords.has(word) && !this.isExcluded(word, ex));

    const pool = validStartingWords.length > 0 ? validStartingWords : this.getRankedOpeners(length, ex);
    if (pool.length === 0) {
      return availableWords[Math.floor(Math.random() * availableWords.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  public selectWord(length: number, testedWords: WordFeedback[], exclusions: Exclusions = {}): string | null {
    const ex = this.buildExclusionSets(exclusions);

    if (testedWords.length === 0) {
      return this.getStartingWord(length, ex);
    }

    const filteredWords = this.getFilteredWords(length, testedWords).filter((word) => !this.isExcluded(word, ex));

    if (filteredWords.length === 0) {
      return null;
    }

    // Use smart selection for smaller candidate sets
    if (filteredWords.length <= this.MAX_CANDIDATES_FOR_ANALYSIS) {
      return this.selectOptimalWord(filteredWords);
    }

    // For large sets, use frequency-based selection
    return this.selectFrequencyBasedWord(filteredWords);
  }

  private getFilteredWords(length: number, testedWords: WordFeedback[]): string[] {
    const cacheKey = this.generateCacheKey(length, testedWords);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const availableWords = this.dictionary[length] || [];
    const filteredWords = this.filterWords(availableWords, testedWords);

    // Cache every result: a game only produces a handful of distinct keys, and caching the
    // large early-round pools is exactly what keeps 6+ letter games responsive (selectWord
    // and the UI analysis reuse the same filtered set instead of re-scanning ~10k-40k words).
    this.cache.set(cacheKey, filteredWords);

    return filteredWords;
  }

  private generateCacheKey(length: number, testedWords: WordFeedback[]): string {
    const wordsKey = testedWords.map((w) => `${w.word}:${w.feedback.join("")}`).join("|");
    return `${length}:${wordsKey}`;
  }

  private selectOptimalWord(candidates: string[]): string {
    if (candidates.length === 1) return candidates[0];

    const scores: WordScore[] = candidates.map((word) => ({
      word,
      score: this.calculateWordScore(word, candidates),
    }));

    // Sort by score (descending) and pick best
    scores.sort((a, b) => b.score - a.score);

    // Add some randomness among top 3 to avoid being too predictable
    const topWords = scores.slice(0, Math.min(3, scores.length));
    return topWords[Math.floor(Math.random() * topWords.length)].word;
  }

  private selectFrequencyBasedWord(candidates: string[]): string {
    const scores: WordScore[] = candidates.map((word) => ({
      word,
      score: this.wordScorer.calculateFrequencyScore(word) + this.wordScorer.calculatePositionScore(word),
    }));

    scores.sort((a, b) => b.score - a.score);

    // Pick from top 10% to balance optimization with variety
    const topCount = Math.max(1, Math.floor(candidates.length * 0.1));
    const topWords = scores.slice(0, topCount);

    return topWords[Math.floor(Math.random() * topWords.length)].word;
  }

  private calculateWordScore(word: string, candidates: string[]): number {
    const informationScore = this.wordScorer.calculateInformationScore(word, candidates);
    const frequencyScore = this.wordScorer.calculateFrequencyScore(word);
    const positionScore = this.wordScorer.calculatePositionScore(word);

    // Weight information theory highest for optimal play
    return informationScore * 10 + frequencyScore * 2 + positionScore;
  }

  public getRemainingWordsCount(length: number, testedWords: WordFeedback[]): number {
    return this.getFilteredWords(length, testedWords).length;
  }

  public getAllWords(length: number): string[] {
    return this.dictionary[length] || [];
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  public getWordAnalysis(
    length: number,
    testedWords: WordFeedback[],
    exclusions: Exclusions = {},
  ): {
    totalWords: number;
    remainingWords: number;
    reductionRatio: number;
    averageScore?: number;
  } {
    const ex = this.buildExclusionSets(exclusions);
    const totalWords = this.getAllWords(length).length;
    const filteredWords = this.getFilteredWords(length, testedWords).filter((word) => !this.isExcluded(word, ex));
    const remainingWords = filteredWords.length;

    let averageScore: number | undefined;
    if (remainingWords <= this.MAX_CANDIDATES_FOR_ANALYSIS && remainingWords > 0) {
      const scores = filteredWords.map((word) => this.calculateWordScore(word, filteredWords));
      averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    return {
      totalWords,
      remainingWords,
      reductionRatio: totalWords > 0 ? remainingWords / totalWords : 0,
      averageScore,
    };
  }
}
