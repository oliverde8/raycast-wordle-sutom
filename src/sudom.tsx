import { useState, useMemo } from "react";
import { Form, ActionPanel, Action, showToast } from "@raycast/api";
import frenchWords from "an-array-of-french-words";

type LetterFeedback = "correct" | "wrong-position" | "not-in-word" | "unknown";

type WordFeedback = {
  word: string;
  feedback: LetterFeedback[];
};

type Values = {
  nbLetters: string;
  letter0?: string;
  letter1?: string;
  letter2?: string;
  letter3?: string;
  letter4?: string;
  letter5?: string;
  letter6?: string;
  letter7?: string;
};

// Function to filter French words by length and common usage
const createWordsDictionary = (): { [key: number]: string[] } => {
  const dictionary: { [key: number]: string[] } = {};

  // Filter words by length and exclude very uncommon or complex words
  const filteredWords = frenchWords.filter((word: string) => {
    const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const basicLettersOnly = /^[a-zA-Z]+$/;
    
    // Check both original and normalized - if they're different, it had accents
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

  // Group by length
  filteredWords.forEach((word: string) => {
    const length = word.length;
    if (!dictionary[length]) {
      dictionary[length] = [];
    }
    dictionary[length].push(word.toLowerCase());
  });

  return dictionary;
};

export default function Command() {
  const [wordLength, setWordLength] = useState<number>(5);
  const [testedWords, setTestedWords] = useState<WordFeedback[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<string>("");
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);

  // Memoize the French words dictionary to avoid recreating it on every render
  const wordsDictionary = useMemo(() => createWordsDictionary(), []);

  // Filter words based on feedback
  const filterWords = (words: string[], feedbackHistory: WordFeedback[]): string[] => {
    return words.filter(word => {
      for (const wordFeedback of feedbackHistory) {
        const testWord = wordFeedback.word.toLowerCase();
        const feedback = wordFeedback.feedback;

        // Count how many times each letter appears with each type of feedback
        const letterCounts = new Map<string, { correct: number; wrongPosition: number; notInWord: number }>();
        
        // First pass: count feedback types for each letter
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

        // Second pass: validate word against all constraints
        for (let i = 0; i < testWord.length; i++) {
          const letter = testWord[i];
          const letterFeedback = feedback[i];

          switch (letterFeedback) {
            case "correct":
              // Letter must be in this exact position
              if (word[i] !== letter) {
                return false;
              }
              break;

            case "wrong-position":
              // Letter must be in word but not in this position
              if (word[i] === letter) {
                return false;
              }
              if (!word.includes(letter)) {
                return false;
              }
              break;

            case "not-in-word":
              // This is more complex - we need to check if this letter appears
              // with correct or wrong-position feedback elsewhere
              const counts = letterCounts.get(letter)!;
              const requiredCount = counts.correct + counts.wrongPosition;
              
              if (requiredCount > 0) {
                // Letter appears elsewhere with positive feedback, so it should be in the word
                // but we need to ensure the word has exactly the right number of this letter
                const actualCount = (word.match(new RegExp(letter, 'g')) || []).length;
                if (actualCount !== requiredCount) {
                  return false;
                }
                // Also ensure this specific position doesn't have this letter
                if (word[i] === letter) {
                  return false;
                }
              } else {
                // Letter should not be anywhere in the word
                if (word.includes(letter)) {
                  return false;
                }
              }
              break;
          }
        }

        // Final validation: ensure all letters with positive feedback are present in sufficient quantities
        for (const [letter, counts] of letterCounts) {
          const requiredCount = counts.correct + counts.wrongPosition;
          if (requiredCount > 0) {
            const actualCount = (word.match(new RegExp(letter, 'g')) || []).length;
            // Word must have AT LEAST the required count, not exactly
            // Unless we have "not-in-word" feedback for the same letter, which would indicate exact count
            if (counts.notInWord > 0) {
              // If we have both positive and negative feedback for same letter, it must be exact
              if (actualCount !== requiredCount) {
                return false;
              }
            } else {
              // If only positive feedback, word can have more instances of this letter
              if (actualCount < requiredCount) {
                return false;
              }
            }
          }
        }
      }
      return true;
    });
  };

  const generateSuggestion = (customTestedWords?: WordFeedback[]) => {
    const availableWords = wordsDictionary[wordLength] || [];
    const wordsToFilter = customTestedWords || testedWords;
    const filteredWords = filterWords(availableWords, wordsToFilter);

    if (filteredWords.length === 0) {
      showToast({
        title: "Aucune suggestion",
        message: "Aucun mot ne correspond aux critères"
      });
      return;
    }

    // Select a random word from filtered results
    const suggestion = filteredWords[Math.floor(Math.random() * filteredWords.length)];
    setCurrentSuggestion(suggestion.toUpperCase());
    setShowFeedbackForm(true);
  };

  const handleLengthSubmit = (values: Values) => {
    const length = parseInt(values.nbLetters);
    setWordLength(length);
    setTestedWords([]);
    setCurrentSuggestion("");
    setShowFeedbackForm(false);

    showToast({
      title: "Longueur définie",
      message: `Prêt à suggérer des mots de ${length} lettres`
    });
    generateSuggestion();
  };

  const handleFeedbackSubmit = (values: Values) => {
    if (!currentSuggestion) return;

    const feedback: LetterFeedback[] = [];
    for (let i = 0; i < wordLength; i++) {
      const letterFeedback = values[`letter${i}` as keyof Values] as LetterFeedback;
      feedback.push(letterFeedback || "unknown");
    }

    const newWordFeedback: WordFeedback = {
      word: currentSuggestion,
      feedback: feedback
    };

    // Create the updated list including the new feedback
    const updatedTestedWords = [...testedWords, newWordFeedback];

    setTestedWords(updatedTestedWords);
    setShowFeedbackForm(false);
    showToast({
      title: "Retour enregistré",
      message: "Prêt pour la prochaine suggestion"
    });
    
    // Pass the updated list directly to avoid state update delay
    generateSuggestion(updatedTestedWords);
  };

  const reset = () => {
    setTestedWords([]);
    setCurrentSuggestion("");
    setShowFeedbackForm(false);
    showToast({ title: "Réinitialisation", message: "Toutes les données effacées" });
  };

  if (!showFeedbackForm) {
    return (
      <Form
        actions={
          <ActionPanel>
            {!currentSuggestion && (
              <Action.SubmitForm title="Définir la longueur" onSubmit={handleLengthSubmit} />
            )}
            {currentSuggestion && (
              <Action title="Nouvelle suggestion" onAction={generateSuggestion} />
            )}
            {(currentSuggestion || testedWords.length > 0) && (
              <Action title="Obtenir suggestion" onAction={generateSuggestion} />
            )}
            {testedWords.length > 0 && (
              <Action title="Réinitialiser" onAction={reset} />
            )}
          </ActionPanel>
        }
      >
        <Form.Dropdown id="nbLetters" title="Longueur du mot" value={wordLength.toString()}>
          <Form.Dropdown.Item value="4" title="4 Lettres" />
          <Form.Dropdown.Item value="5" title="5 Lettres" />
          <Form.Dropdown.Item value="6" title="6 Lettres" />
          <Form.Dropdown.Item value="7" title="7 Lettres" />
          <Form.Dropdown.Item value="8" title="8 Lettres" />
        </Form.Dropdown>
      </Form>
    );
  }

  // Feedback form
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Valider le retour" onSubmit={handleFeedbackSubmit} />
          <Action title="Annuler" onAction={() => setShowFeedbackForm(false)} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Mot"
        text={`Donnez votre retour pour : ${currentSuggestion}`}
      />

      {Array.from({ length: wordLength }, (_, i) => (
        <Form.Dropdown
          key={i}
          id={`letter${i}`}
          title={`Lettre ${i + 1} (${currentSuggestion[i]})`}
        >
          <Form.Dropdown.Item value="correct" title="✅ Bonne position" />
          <Form.Dropdown.Item value="wrong-position" title="🟡 Mauvaise position" />
          <Form.Dropdown.Item value="not-in-word" title="❌ Pas dans le mot" />
        </Form.Dropdown>
      ))}

              {currentSuggestion && (
          <Form.Description
            title="Suggestion actuelle"
            text={`Essayez ce mot : ${currentSuggestion}`}
          />
        )}

        {testedWords.length > 0 && (
          <Form.Description
            title="Mots testés"
            text={`${testedWords.length} mot(s) testé(s) : ${testedWords.map(w => w.word).join(", ")}`}
          />
        )}

        {wordsDictionary[wordLength] && (
          <Form.Description
            title="Mots disponibles"
            text={`${filterWords(wordsDictionary[wordLength], testedWords).length} mots restants`}
          />
        )}
    </Form>
  );
}
