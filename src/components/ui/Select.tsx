"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  searchable?: boolean;
  name?: string;
  id?: string;
}

export function CustomSelect({
  value,
  onChange,
  options: rawOptions,
  placeholder = "Select an option",
  label,
  disabled = false,
  className = "",
  dropdownClassName = "",
  searchable,
  name,
  id: customId,
}: CustomSelectProps) {
  const generatedId = useId();
  const id = customId || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption[]
  const options: SelectOption[] = React.useMemo(() => {
    return rawOptions.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [rawOptions]);

  // Selected option label
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Searchable threshold: auto-enable if > 8 options unless explicitly set
  const isSearchable = searchable !== undefined ? searchable : options.length > 8;

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(q) || (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative w-full ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      {/* Hidden input for form integrations */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors hover:bg-slate-100 focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-750 text-left ${className}`}
      >
        <span className={`truncate ${!selectedOption ? "text-slate-400 dark:text-slate-500" : "font-medium"}`}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown / Modal Overlay */}
      {isOpen && (
        <>
          {/* Mobile Backdrop blur overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery("");
            }}
            aria-hidden="true"
          />

          {/* Menu panel: Centered bottom sheet on mobile, anchored popover on desktop */}
          <div
            role="listbox"
            aria-labelledby={id}
            className={`fixed md:absolute bottom-0 left-0 right-0 md:bottom-auto md:top-full md:left-0 md:right-0 z-50 mt-1 max-h-[85vh] md:max-h-72 w-full flex flex-col rounded-t-2xl md:rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${dropdownClassName}`}
          >
            {/* Mobile Header / Title */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:hidden dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {label || placeholder || "Select"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Optional Search Bar for long lists (e.g. NCERT chapters) */}
            {isSearchable && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 py-1.5 text-xs text-slate-900 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto overscroll-contain py-1 max-h-[60vh] md:max-h-60">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 md:py-2.5 text-sm transition-colors text-left ${
                        isSelected
                          ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                      } ${opt.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="flex-1 pr-3 truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.description && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {opt.description}
                          </div>
                        )}
                      </div>

                      {/* Radio button indicator (matching mobile design in reference screenshot) */}
                      <div
                        className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "border-teal-500 bg-teal-500/10 dark:border-teal-400"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && (
                          <div className="h-2.5 w-2.5 rounded-full bg-teal-500 dark:bg-teal-400" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
