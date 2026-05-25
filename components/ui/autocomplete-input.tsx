"use client"

import { useState, useRef, useEffect } from "react"

interface AutocompleteInputProps {
  suggestions: string[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  maxSuggestions?: number
}

export function AutocompleteInput({
  suggestions,
  values,
  onChange,
  placeholder = "Type to search...",
  maxSuggestions = 6,
}: AutocompleteInputProps) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.length > 0
    ? suggestions
        .filter(s => s.toLowerCase().includes(query.toLowerCase()))
        .filter(s => !values.includes(s))
        .slice(0, maxSuggestions)
    : []

  function addValue(val: string) {
    if (!values.includes(val)) {
      onChange([...values, val])
    }
    setQuery("")
    inputRef.current?.focus()
  }

  function removeValue(val: string) {
    onChange(values.filter(v => v !== val))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault()
      if (filtered.length > 0) {
        addValue(filtered[0])
      } else if (query.trim().length > 1) {
        addValue(query.trim())
      }
    }
    if (e.key === "Backspace" && query === "" && values.length > 0) {
      removeValue(values[values.length - 1])
    }
  }

  return (
    <div className="space-y-3">
      {/* Selected values */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-sm text-[#1d1d1f]"
            >
              {v}
              <button
                onClick={() => removeValue(v)}
                className="text-[#86868b] hover:text-[#1d1d1f] transition-all"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-white text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]/40 transition-all"
        />

        {/* Suggestions dropdown */}
        {focused && filtered.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
            {filtered.map(s => (
              <button
                key={s}
                onMouseDown={() => addValue(s)}
                className="w-full text-left px-4 py-3 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
