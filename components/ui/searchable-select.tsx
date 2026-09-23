"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X as XIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SearchableSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** True while `options` is still being fetched. */
  loading?: boolean;
  placeholder?: string;
  loadingPlaceholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** When true, lets the user commit whatever they typed even if it doesn't match a listed option. */
  allowCustomValue?: boolean;
  /** Id of an external <label> that already labels this field — skips rendering the internal one. */
  externalLabelledBy?: string;
}

// A trigger button + searchable popover, used for domain-style pickers.
// Deliberately only disables the trigger while `loading` is true — an empty
// `options` list still opens the popover and shows `emptyMessage` inside it,
// rather than disabling the trigger (which would also hide the search input).
export function SearchableSelect({
  id,
  label,
  value,
  onChange,
  options,
  loading = false,
  placeholder = "Select…",
  loadingPlaceholder = "Loading…",
  emptyMessage = "No results found",
  searchPlaceholder = "Search…",
  allowCustomValue = false,
  externalLabelledBy,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = externalLabelledBy ?? `${id}-label`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const trimmedSearch = search.trim();
  const hasExactMatch = options.some((o) => o.toLowerCase() === trimmedSearch.toLowerCase());
  const showCustomOption = allowCustomValue && trimmedSearch.length > 0 && !hasExactMatch;

  function select(option: string) {
    onChange(option);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="space-y-2">
      {!externalLabelledBy && <Label id={labelId} htmlFor={id}>{label}</Label>}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={labelId}
          onClick={() => {
            if (loading) return;
            setOpen((v) => !v);
            setSearch("");
          }}
          disabled={loading}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || (loading ? loadingPlaceholder : placeholder)}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 ml-2 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute z-50 top-full left-0 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <XIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div role="listbox" className="max-h-52 overflow-y-auto py-1">
              {showCustomOption && (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => select(trimmedSearch)}
                  className="w-full flex items-center px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left truncate border-b border-border"
                >
                  Use &ldquo;{trimmedSearch}&rdquo;
                </button>
              )}
              {filtered.length === 0 && !showCustomOption ? (
                <p className="text-xs text-muted-foreground text-center py-4">{emptyMessage}</p>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={value === option}
                    onClick={() => select(option)}
                    className={cn(
                      "w-full flex items-center px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left truncate",
                      value === option && "bg-primary/5 text-primary font-medium"
                    )}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
