import { useState, useMemo } from "react";
import { Form, ActionPanel, Action, showToast } from "@raycast/api";
import { WordSelector, type WordFeedback, type LetterFeedback } from "./lib/wordSelector";

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

export default function Command() {
  const [wordLength, setWordLength] = useState<number>(5);
  const [testedWords, setTestedWords] = useState<WordFeedback[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<string>("");
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);

  const wordSelector = useMemo(() => new WordSelector(), []);

  const generateSuggestion = (customTestedWords?: WordFeedback[]) => {
    const wordsToFilter = customTestedWords || testedWords;
    const suggestion = wordSelector.selectWord(wordLength, wordsToFilter);

    if (!suggestion) {
      showToast({
        title: "Aucune suggestion",
        message: "Aucun mot ne correspond aux critères"
      });
      return;
    }

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

    const updatedTestedWords = [...testedWords, newWordFeedback];

    setTestedWords(updatedTestedWords);
    setShowFeedbackForm(false);
    showToast({
      title: "Retour enregistré",
      message: "Prêt pour la prochaine suggestion"
    });
    
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
              <Action.SubmitForm title="Définir La Longueur" onSubmit={handleLengthSubmit} />
            )}
            {currentSuggestion && (
              <Action title="Nouvelle Suggestion" onAction={generateSuggestion} />
            )}
            {(currentSuggestion || testedWords.length > 0) && (
              <Action title="Obtenir Suggestion" onAction={generateSuggestion} />
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

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Valider Le Retour" onSubmit={handleFeedbackSubmit} />
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

      {wordSelector.getAllWords(wordLength).length > 0 && (
        <Form.Description
          title="Mots disponibles"
          text={`${wordSelector.getRemainingWordsCount(wordLength, testedWords)} mots restants`}
        />
      )}
    </Form>
  );
}
