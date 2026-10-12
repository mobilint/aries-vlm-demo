import enTexts from "./i18n/en.json";
import koTexts from "./i18n/ko.json";
import jaTexts from "./i18n/ja.json";
import zhTexts from "./i18n/zh.json";
import { exampleQuestionsByLanguage } from "./questions/catalog";

export type ExampleQuestion = {
  image: string,
  question: string,
};

export type LanguageText = {
  appTitle: string,
  imagePanelTitle: string,
  chatPanelTitle: string,
  autoLabel: string,
  inputPlaceholder: string,
  reset: string,
  liveCam: string,
  screenshot: string,
  galleryHint: string,
  galleryTitle: string,
  languageLabel: string,
  statusConnecting: string,
  statusPreparingPromptBundle: string,
};

export type PromptBundle = {
  system_prompt: string,
  inter_prompt: string,
};

export const DEFAULT_LANGUAGE = "en";
export const AVAILABLE_LANGUAGES = ["en", "ko", "ja", "zh"] as const;
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

export const images: string[] = [
  "people.jpg",
  "crossroad.jpg",
  "ai_suspicious.png",
  "ai_fire.png",
];

export const example_questions_by_language = exampleQuestionsByLanguage;

export const language_labels: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
};

export const language_texts: Record<string, LanguageText> = {
  en: enTexts,
  ko: koTexts,
  ja: jaTexts,
  zh: zhTexts,
};

export function getLanguageTexts(language: string): LanguageText {
  return language_texts[language] ?? language_texts[DEFAULT_LANGUAGE];
}

export function getVlmModelLabel(modelId: string): string {
  const modelName = modelId.split("/").pop() ?? modelId;
  return modelName.replace(/-Instruct$/i, "");
}

export async function loadPromptBundle(language: string): Promise<PromptBundle> {
  const locale = AVAILABLE_LANGUAGES.includes(language as typeof AVAILABLE_LANGUAGES[number])
    ? language
    : DEFAULT_LANGUAGE;

  const [systemPrompt, interPrompt] = await Promise.all([
    fetch(`/prompt-bundles/${locale}/system.txt`).then((response) => response.text()),
    fetch(`/prompt-bundles/${locale}/inter.txt`).then((response) => response.text()),
  ]);

  return {
    system_prompt: systemPrompt.trim(),
    inter_prompt: interPrompt.trim(),
  };
}
