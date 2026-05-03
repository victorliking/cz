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

// Curated Unsplash images for Saturday morning scenarios
export const SATURDAY_IMAGES: Record<string, string> = {
  "Coffee by big windows, watching the light":
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=250&fit=crop&crop=center",
  "Cooking breakfast in a chef's kitchen":
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=250&fit=crop&crop=center",
  "Playing with kids in the yard":
    "https://images.unsplash.com/photo-1540479859555-17af45c78602?w=400&h=250&fit=crop&crop=center",
  "Walking kids to school or the playground":
    "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=400&h=250&fit=crop&crop=center",
  "Working from my home office":
    "https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=250&fit=crop&crop=center",
  "Reading quietly — total silence":
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=250&fit=crop&crop=center",
  "Walking to a café or farmers market":
    "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&h=250&fit=crop&crop=center",
  "Quick errands — grocery, pharmacy all nearby":
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=250&fit=crop&crop=center",
  "Going for a run, bike ride, or to the gym":
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop&crop=center",
  "Gardening or tinkering outside":
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=250&fit=crop&crop=center",
  "Walking the dog in a nearby park":
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=250&fit=crop&crop=center",
  "Hosting friends who stayed over":
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=250&fit=crop&crop=center",
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
