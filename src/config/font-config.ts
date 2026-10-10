const fontConfig = {
  en: {
    "font-dynamic": {
      fontFamily: "InterRegular",
    },
  },
  "bo-IN": {
    "font-dynamic": {
      fontFamily: "MonlamUniOuChan2",
    },
  },
  zh: {
    "font-dynamic": {
      fontFamily:
        '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "InterRegular", sans-serif',
    },
  },
};

export const setFontVariables = (language: string) => {
  const root = document.getElementById("root");
  const fonts =
    fontConfig[language as keyof typeof fontConfig] || fontConfig["en"];

  Object.entries(fonts).forEach(([key, styles]) => {
    const cssVarName = `--${key}-font-family`;
    root?.style.setProperty(cssVarName, styles.fontFamily);
  });
  document.documentElement.lang = language;
};

export default fontConfig;
