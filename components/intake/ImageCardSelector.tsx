"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"

interface ImageOption {
  label: string
  image: string // Unsplash URL
}

interface ImageCardSelectorProps {
  options: ImageOption[]
  value: string[]
  onChange: (val: string[]) => void
  maxSelections?: number
}

// Curated Unsplash images — unified warm/bright lifestyle aesthetic
export const SATURDAY_IMAGES: Record<string, string> = {
  "Coffee by big windows, watching the light":
    "https://images.unsplash.com/photo-1494314671902-399b18174975?w=400&h=250&fit=crop&crop=center",
  "Cooking breakfast in a chef's kitchen":
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=250&fit=crop&crop=center",
  "Playing with kids in the yard":
    "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=400&h=250&fit=crop&crop=center",
  "Walking kids to school or the playground":
    "https://images.unsplash.com/photo-1564429238961-bf8f8be663c2?w=400&h=250&fit=crop&crop=center",
  "Working from my home office":
    "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=250&fit=crop&crop=center",
  "Reading quietly — total silence":
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=250&fit=crop&crop=center",
  "Walking to a café or farmers market":
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=250&fit=crop&crop=center",
  "Quick errands — grocery, pharmacy all nearby":
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=250&fit=crop&crop=center",
  "Going for a run, bike ride, or to the gym":
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=250&fit=crop&crop=center",
  "Gardening or tinkering outside":
    "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&h=250&fit=crop&crop=center",
  "Walking the dog in a nearby park":
    "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=400&h=250&fit=crop&crop=center",
  "Hosting friends who stayed over":
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=250&fit=crop&crop=center",
}

export function ImageCardSelector({
  options,
  value,
  onChange,
  maxSelections,
}: ImageCardSelectorProps) {
  const toggle = (label: string) => {
    if (value.includes(label)) {
      onChange(value.filter((v) => v !== label))
    } else {
      if (maxSelections && value.length >= maxSelections) return
      onChange([...value, label])
    }
  }

  return (
    <div className="space-y-3">
      {maxSelections && (
        <p className="text-xs text-slate-400">{value.length}/{maxSelections} selected</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = value.includes(opt.label)
          const isDisabled = !isSelected && maxSelections !== undefined && value.length >= maxSelections

          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => toggle(opt.label)}
              disabled={isDisabled}
              className={cn(
                "relative rounded-xl overflow-hidden h-28 group transition-all duration-200",
                isSelected
                  ? "ring-3 ring-blue-500 scale-[1.02] shadow-lg"
                  : "ring-1 ring-slate-200 hover:ring-blue-200",
                isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              {/* Background image */}
              <img
                src={opt.image}
                alt={opt.label}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />

              {/* Gradient overlay */}
              <div className={cn(
                "absolute inset-0 transition-colors",
                isSelected
                  ? "bg-gradient-to-t from-blue-900/80 via-blue-900/40 to-blue-900/20"
                  : "bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/60"
              )} />

              {/* Check mark */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}

              {/* Label */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-white text-xs font-medium leading-tight drop-shadow-md">
                  {opt.label}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
