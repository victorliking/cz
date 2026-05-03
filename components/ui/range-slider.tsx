"use client"

import { useCallback, useRef, useState, useEffect } from "react"

interface RangeSliderProps {
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  formatLabel?: (val: number) => string
  className?: string
}

export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  formatLabel = (v) => String(v),
  className = "",
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<"min" | "max" | null>(null)

  const getPercent = (val: number) => ((val - min) / (max - min)) * 100

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return min
      const rect = track.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const rawValue = min + percent * (max - min)
      return Math.round(rawValue / step) * step
    },
    [min, max, step]
  )

  const handlePointerDown = (thumb: "min" | "max") => (e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(thumb)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return
      const newVal = getValueFromPosition(e.clientX)
      if (dragging === "min") {
        const clamped = Math.min(newVal, value[1])
        onChange([clamped, value[1]])
      } else {
        const clamped = Math.max(newVal, value[0])
        onChange([value[0], clamped])
      }
    },
    [dragging, getValueFromPosition, onChange, value]
  )

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  const leftPercent = getPercent(value[0])
  const rightPercent = getPercent(value[1])

  return (
    <div className={`relative py-4 ${className}`}>
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-2 bg-slate-200 rounded-full cursor-pointer"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Active range fill */}
        <div
          className="absolute h-full bg-blue-400 rounded-full"
          style={{
            left: `${leftPercent}%`,
            width: `${rightPercent - leftPercent}%`,
          }}
        />

        {/* Min thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
          style={{ left: `${leftPercent}%` }}
          onPointerDown={handlePointerDown("min")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Max thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
          style={{ left: `${rightPercent}%` }}
          onPointerDown={handlePointerDown("max")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2">
        <span className="text-xs text-slate-400">{formatLabel(min)}</span>
        <span className="text-xs text-slate-400">{formatLabel(max)}</span>
      </div>
    </div>
  )
}
