import enQuestions from "./locales/en.json";
import koQuestions from "./locales/ko.json";
import jaQuestions from "./locales/ja.json";
import zhQuestions from "./locales/zh.json";
import { ExampleQuestion } from "../settings";

const QUESTIONS_BY_LANGUAGE: Record<string, Record<string, string[]>> = {
  en: enQuestions,
  ko: koQuestions,
  ja: jaQuestions,
  zh: zhQuestions,
};

function flatten(byImage: Record<string, string[]>): ExampleQuestion[] {
  return Object.entries(byImage).flatMap(([image, questions]) =>
    questions.map((question) => ({ image, question })),
  );
}

export const exampleQuestionsByLanguage: Record<string, ExampleQuestion[]> =
  Object.fromEntries(
    Object.entries(QUESTIONS_BY_LANGUAGE).map(([lang, byImage]) => [lang, flatten(byImage)]),
  );
