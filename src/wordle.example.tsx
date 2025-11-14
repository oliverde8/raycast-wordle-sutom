import { WordGameComponent } from "./lib/WordGameComponent";
import { englishConfig } from "./lib/english.config";

export default function WordleCommand() {
  return <WordGameComponent config={englishConfig} />;
}