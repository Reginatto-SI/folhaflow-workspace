// Comentário: atributos reutilizáveis para impedir tradução automática em textos oficiais do Folha App.
export const NO_TRANSLATE_LANG = "pt-BR";

export const noTranslateProps = {
  className: "notranslate",
  translate: "no" as const,
  lang: NO_TRANSLATE_LANG,
};

export const noTranslateAttributes = {
  translate: "no" as const,
  lang: NO_TRANSLATE_LANG,
};

export const withNoTranslateClass = (className = "") =>
  [noTranslateProps.className, className].filter(Boolean).join(" ");
