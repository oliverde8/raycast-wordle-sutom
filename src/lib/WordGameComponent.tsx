import { useState, useMemo } from "react";
import { Form, ActionPanel, Action, showToast } from "@raycast/api";
import { WordSelector, type WordFeedback, type LetterFeedback, type Exclusions } from "./wordSelector";
import type { LanguageConfig } from "./languageConfig";

type Values = {
  nbLetters: string;
  excludedWords?: string;
  excludedLetters?: string;
};

interface WordGameProps {
  config: LanguageConfig;
}

// Parse a free-text list (newlines / commas / spaces) into a deduped, uppercased word list.
function parseWordList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((w) => w.trim().toUpperCase())
        .filter((w) => w.length > 0),
    ),
  ];
}

// Initial per-letter state for a new suggestion: positions already known to be correct are
// pre-filled as "correct" (the solver guarantees the new word has the same letter there, so
// the user should not have to re-enter them); everything else starts at "unknown".
function initialFeedback(history: WordFeedback[], length: number): LetterFeedback[] {
  const feedback: LetterFeedback[] = new Array(length).fill("unknown");
  for (const tested of history) {
    tested.feedback.forEach((state, i) => {
      if (state === "correct" && i < length) feedback[i] = "correct";
    });
  }
  return feedback;
}

export function WordGameComponent({ config }: WordGameProps) {
  const [wordLength, setWordLength] = useState<number>(6);
  const [testedWords, setTestedWords] = useState<WordFeedback[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<string>("");
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);
  // Per-letter feedback for the current suggestion. Reset on every new suggestion so a round
  // never inherits the previous word's colours; letters left "unknown" add no constraint.
  const [letterFeedback, setLetterFeedback] = useState<LetterFeedback[]>([]);
  // Session-only exclusions: words the game rejects and letters known to be absent.
  const [excludedWords, setExcludedWords] = useState<string[]>([]);
  const [excludedLetters, setExcludedLetters] = useState<string>("");

  const wordSelector = useMemo(() => new WordSelector(config), [config]);

  const currentExclusions = (): Exclusions => ({ words: excludedWords, letters: [excludedLetters] });

  // Computed once per round (deps exclude letterFeedback), so editing a dropdown does not
  // re-filter the whole dictionary — this is what keeps 6+ letter games responsive.
  const analysisInfo = useMemo(() => {
    const totalWords = wordSelector.getAllWords(wordLength).length;
    if (totalWords === 0) return null;
    return {
      analysis: wordSelector.getWordAnalysis(wordLength, testedWords, {
        words: excludedWords,
        letters: [excludedLetters],
      }),
    };
  }, [wordSelector, wordLength, testedWords, excludedWords, excludedLetters]);

  const generateSuggestion = (
    customTestedWords?: WordFeedback[],
    customLength?: number,
    customExclusions?: Exclusions,
  ) => {
    const wordsToFilter = customTestedWords || testedWords;
    const lengthToUse = customLength || wordLength;
    const exclusions = customExclusions ?? currentExclusions();
    const suggestion = wordSelector.selectWord(lengthToUse, wordsToFilter, exclusions);

    if (!suggestion) {
      showToast({
        title: config.ui.noSuggestionTitle,
        message: config.ui.noSuggestionMessage,
      });
      return;
    }

    setCurrentSuggestion(suggestion.toUpperCase());
    setLetterFeedback(initialFeedback(wordsToFilter, suggestion.length));
    setShowFeedbackForm(true);
  };

  const handleLengthSubmit = (values: Values) => {
    const length = parseInt(values.nbLetters);
    const words = parseWordList(values.excludedWords ?? "");
    const letters = (values.excludedLetters ?? "").trim();
    setWordLength(length);
    setTestedWords([]);
    setCurrentSuggestion("");
    setShowFeedbackForm(false);
    setExcludedWords(words);
    setExcludedLetters(letters);

    showToast({
      title: config.ui.lengthSetTitle,
      message: config.ui.lengthSetMessage(length),
    });
    // Pass an explicit empty history so the first suggestion never uses a previous game's
    // (not-yet-flushed) tested words.
    generateSuggestion([], length, { words, letters: [letters] });
  };

  const handleFeedbackSubmit = () => {
    if (!currentSuggestion) return;

    const feedback: LetterFeedback[] = [];
    for (let i = 0; i < currentSuggestion.length; i++) {
      feedback.push(letterFeedback[i] ?? "unknown");
    }

    const updatedTestedWords = [...testedWords, { word: currentSuggestion, feedback }];

    setTestedWords(updatedTestedWords);
    setShowFeedbackForm(false);
    showToast({
      title: config.ui.feedbackSavedTitle,
      message: config.ui.feedbackSavedMessage,
    });

    generateSuggestion(updatedTestedWords);
  };

  // The current suggestion is a word the game rejected as non-existent: exclude it and
  // immediately propose a different one (feedback history is unchanged).
  const handleRejectWord = () => {
    if (!currentSuggestion) return;
    const updated = [...new Set([...excludedWords, currentSuggestion.toUpperCase()])];
    setExcludedWords(updated);
    showToast({
      title: config.ui.wordRejectedTitle,
      message: config.ui.wordRejectedMessage,
    });
    generateSuggestion(undefined, undefined, { words: updated, letters: [excludedLetters] });
  };

  const handleSaveExcluded = (values: Values) => {
    const words = parseWordList(values.excludedWords ?? "");
    const letters = (values.excludedLetters ?? "").trim();
    setExcludedWords(words);
    setExcludedLetters(letters);
    showToast({ title: config.ui.saveExcludedAction });
    // Only re-suggest if a game is already in progress; otherwise just save the lists.
    if (currentSuggestion) {
      generateSuggestion(undefined, undefined, { words, letters: [letters] });
    }
  };

  const handleClearExcluded = () => {
    setExcludedWords([]);
    setExcludedLetters("");
    showToast({ title: config.ui.clearExcludedAction });
  };

  const reset = () => {
    setTestedWords([]);
    setCurrentSuggestion("");
    setShowFeedbackForm(false);
    setLetterFeedback([]);
    wordSelector.clearCache();
    showToast({
      title: config.ui.resetTitle,
      message: config.ui.resetMessage,
    });
  };

  const updateLetterFeedback = (index: number, value: LetterFeedback) => {
    setLetterFeedback((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Generate length options based on config
  const lengthOptions = [];
  for (let i = config.wordFilter.minLength; i <= config.wordFilter.maxLength; i++) {
    lengthOptions.push(<Form.Dropdown.Item key={i} value={i.toString()} title={`${i} ${config.ui.lettersUnit}`} />);
  }

  // History of previous guesses shown with each letter's state (e.g. "S❌ A❌ T🟡 I🟡 R🟡 E🟡").
  const feedbackEmoji: Record<LetterFeedback, string> = {
    correct: "✅",
    "wrong-position": "🟡",
    "not-in-word": "❌",
    unknown: "⬜",
  };
  const historyItems = testedWords.map((tw, idx) => (
    <Form.Description
      key={`history-${idx}`}
      title={`${idx + 1}. ${tw.word}`}
      text={tw.word
        .split("")
        .map((ch, i) => `${ch}${feedbackEmoji[tw.feedback[i] ?? "unknown"]}`)
        .join("  ")}
    />
  ));

  if (!showFeedbackForm) {
    return (
      <Form
        key="length-form"
        actions={
          <ActionPanel>
            {currentSuggestion && (
              <Action title={config.ui.getSuggestionAction} onAction={() => generateSuggestion()} />
            )}
            {/* Set Length stays available so the word length can be changed mid-session (it
                resets the game). It is the primary action only when no game is in progress. */}
            <Action.SubmitForm title={config.ui.setLengthAction} onSubmit={handleLengthSubmit} />
            <Action.SubmitForm title={config.ui.saveExcludedAction} onSubmit={handleSaveExcluded} />
            {(excludedWords.length > 0 || excludedLetters.length > 0) && (
              <Action title={config.ui.clearExcludedAction} onAction={handleClearExcluded} />
            )}
            {testedWords.length > 0 && <Action title={config.ui.resetAction} onAction={reset} />}
          </ActionPanel>
        }
      >
        <Form.Dropdown id="nbLetters" title={config.ui.lengthLabel} defaultValue={wordLength.toString()}>
          {lengthOptions}
        </Form.Dropdown>

        <Form.TextArea
          id="excludedWords"
          title={config.ui.excludedWordsLabel}
          placeholder={config.ui.excludedWordsPlaceholder}
          defaultValue={excludedWords.join("\n")}
        />
        <Form.TextField
          id="excludedLetters"
          title={config.ui.excludedLettersLabel}
          placeholder={config.ui.excludedLettersPlaceholder}
          defaultValue={excludedLetters}
        />

        {currentSuggestion && (
          <Form.Description
            title={config.ui.suggestionLabel}
            text={`${config.ui.tryWordLabel}: ${currentSuggestion}`}
          />
        )}

        {testedWords.length > 0 && (
          <Form.Description
            title={config.ui.testedWordsLabel}
            text={`${testedWords.length} ${config.ui.testedWordCount}`}
          />
        )}
        {historyItems}
      </Form>
    );
  }

  return (
    <Form
      key="feedback-form"
      actions={
        <ActionPanel>
          <Action.SubmitForm title={config.ui.submitFeedbackAction} onSubmit={handleFeedbackSubmit} />
          <Action title={config.ui.rejectWordAction} onAction={handleRejectWord} />
          <Action title={config.ui.cancelAction} onAction={() => setShowFeedbackForm(false)} />
        </ActionPanel>
      }
    >
      <Form.Description title={config.ui.suggestionLabel} text={`${config.ui.feedbackPrompt}: ${currentSuggestion}`} />

      {Array.from({ length: currentSuggestion.length }, (_, i) => (
        <Form.Dropdown
          key={i}
          id={`letter${i}`}
          title={`${config.ui.letterLabel} ${i + 1} (${currentSuggestion[i] ?? ""})`}
          value={letterFeedback[i] ?? "unknown"}
          onChange={(newValue) => updateLetterFeedback(i, newValue as LetterFeedback)}
        >
          <Form.Dropdown.Item value="unknown" title={config.ui.notSetLabel} />
          <Form.Dropdown.Item value="correct" title={`✅ ${config.ui.correctPositionLabel}`} />
          <Form.Dropdown.Item value="wrong-position" title={`🟡 ${config.ui.wrongPositionLabel}`} />
          <Form.Dropdown.Item value="not-in-word" title={`❌ ${config.ui.notInWordLabel}`} />
        </Form.Dropdown>
      ))}

      {testedWords.length > 0 && (
        <Form.Description
          title={config.ui.testedWordsLabel}
          text={`${testedWords.length} ${config.ui.testedWordCount}`}
        />
      )}
      {historyItems}

      {analysisInfo &&
        (() => {
          const { analysis } = analysisInfo;
          const reductionPercentage = ((1 - analysis.reductionRatio) * 100).toFixed(1);
          return (
            <Form.Description
              title={config.ui.analysisLabel}
              text={`${analysis.remainingWords}/${analysis.totalWords} ${config.ui.wordsRemainingLabel} (${reductionPercentage}% ${config.ui.eliminatedLabel})${
                analysis.averageScore ? ` - ${config.ui.averageScoreLabel}: ${analysis.averageScore.toFixed(1)}` : ""
              }`}
            />
          );
        })()}
    </Form>
  );
}
