import { useCallback, useEffect, useRef, useState } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { IoMdClose } from "react-icons/io";
import { MdLocationOn } from "react-icons/md";
import { useTranslate } from "@tolgee/react";
import {
  isPlaceSearchEnabled,
  searchPlaces,
  PLACE_SEARCH_DEBOUNCE_MS,
  PLACE_SEARCH_MIN_LENGTH,
  type PlaceResult,
} from "../../api/placeSearchApi";

// Translation key; rendered through t().
const SEARCH_ERROR = "studio.groups.locations.place_search.error";

type PlaceSearchProps = {
  onSelect: (place: PlaceResult) => void;
  disabled?: boolean;
};

const PlaceSearch = ({ onSelect, disabled = false }: PlaceSearchProps) => {
  const { t } = useTranslate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const enabled = isPlaceSearchEnabled() && !disabled;
  const trimmed = query.trim();

  const runSearch = useCallback((value: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    searchPlaces(value, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setResults(found);
        setOpen(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(SEARCH_ERROR);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
  }, []);

  const resetResults = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setSearching(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    if (trimmed === selectedLabel) return;

    if (trimmed.length < PLACE_SEARCH_MIN_LENGTH) {
      resetResults();
      return;
    }

    setSearching(true);
    setError(null);

    const timer = setTimeout(
      () => runSearch(trimmed),
      PLACE_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [trimmed, enabled, selectedLabel, runSearch, resetResults]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleSelect = (place: PlaceResult) => {
    abortRef.current?.abort();
    setSelectedLabel(place.primary.trim());
    onSelect(place);
    setQuery(place.primary);
    setResults([]);
    setSearching(false);
    setOpen(false);
  };

  const reset = () => {
    resetResults();
    setSelectedLabel(null);
    setQuery("");
    setOpen(false);
  };

  const showNoResults =
    isOpen &&
    !isSearching &&
    !error &&
    results.length === 0 &&
    trimmed.length >= PLACE_SEARCH_MIN_LENGTH;

  if (!isPlaceSearchEnabled()) return null;

  return (
    <div className="space-y-1">
      <div className="relative">
        <FaMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={t("studio.groups.locations.place_search.placeholder")}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
            if (e.key === "Escape") setOpen(false);
          }}
          className="h-10 w-full rounded-md border border-input bg-white pl-10 pr-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#262626] dark:text-white"
        />
        {query ? (
          <button
            type="button"
            onClick={reset}
            aria-label={t("studio.groups.locations.place_search.clear_aria")}
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
          >
            <IoMdClose className="h-4 w-4" />
          </button>
        ) : null}

        {isOpen && (isSearching || results.length > 0 || showNoResults) ? (
          <div className="absolute z-[1000] mt-1 max-h-52 w-full overflow-auto rounded-md border border-input bg-background shadow-md dark:bg-[#262626]">
            {isSearching && results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.groups.shared.searching")}
              </div>
            ) : null}

            {results.map((place) => (
              <button
                key={place.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(place);
                }}
                className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-[#333333]"
              >
                <MdLocationOn className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {place.primary}
                  </span>
                  {place.secondary ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {place.secondary}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}

            {showNoResults ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.groups.locations.place_search.no_results")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{t(error)}</p> : null}

      <p className="text-right text-[10px] text-muted-foreground">
        {t("studio.groups.locations.place_search.attribution")}{" "}
        <a
          href="https://locationiq.com"
          target="_blank"
          rel="noreferrer noopener"
          className="underline hover:text-foreground"
        >
          LocationIQ.com
        </a>
      </p>
    </div>
  );
};

export default PlaceSearch;
