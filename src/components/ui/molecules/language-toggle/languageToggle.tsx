import { IoLanguage } from "react-icons/io5";
import { IoCheckmark } from "react-icons/io5";
import { useTolgee, useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { LANGUAGE } from "../../../../lib/constant";
import { setFontVariables } from "../../../../config/font-config";
import { UI_LANGUAGES } from "@/i18n/languages";

export function LanguageToggle() {
  const tolgee = useTolgee(["language"]);
  const { t } = useTranslate();
  const current = tolgee.getLanguage();

  const changeLanguage = async (language: string) => {
    await tolgee.changeLanguage(language);
    localStorage.setItem(LANGUAGE, language);
    setFontVariables(language);
  };

  return (
    <Pecha.DropdownMenu>
      <Pecha.DropdownMenuTrigger asChild>
        <Pecha.Button
          variant="outline"
          size="icon"
          aria-label={t("studio.nav.change_language")}
        >
          <IoLanguage className="h-[1.2rem] w-[1.2rem]" />
        </Pecha.Button>
      </Pecha.DropdownMenuTrigger>
      <Pecha.DropdownMenuContent align="end">
        {UI_LANGUAGES.map((language) => (
          <Pecha.DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={`${language.fontClass} justify-between gap-4`}
          >
            <span lang={language.code}>{language.label}</span>
            {current === language.code && (
              <IoCheckmark className="h-4 w-4" aria-hidden />
            )}
          </Pecha.DropdownMenuItem>
        ))}
      </Pecha.DropdownMenuContent>
    </Pecha.DropdownMenu>
  );
}
