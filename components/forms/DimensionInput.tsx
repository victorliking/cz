"use client"

import { Dimension } from "@/lib/vector-schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface DimensionInputProps {
  dimension: Dimension
  value: unknown
  onChange: (key: string, value: unknown) => void
  className?: string
}

/**
 * Smart input component that switches type based on dimension.dataType:
 * - number: numeric input
 * - score_1_5: 5-star button group
 * - enum: dropdown select
 * - bool: toggle switch
 */
export function DimensionInput({
  dimension,
  value,
  onChange,
  className,
}: DimensionInputProps) {
  const { key, label, dataType, enumValues } = dimension

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={key} className="text-sm font-medium">
        {label}
      </Label>

      {dataType === "number" && (
        <Input
          id={key}
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value
            onChange(key, v === "" ? null : Number(v))
          }}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="w-full"
        />
      )}

      {dataType === "score_1_5" && (
        <ScoreButtons
          value={value as number | null}
          onChange={(v) => onChange(key, v)}
        />
      )}

      {dataType === "enum" && enumValues && (
        <Select
          value={value === null || value === undefined ? "" : String(value)}
          onValueChange={(v) => onChange(key, v === "" ? null : v)}
        >
          <SelectTrigger id={key}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {enumValues.map((ev) => (
              <SelectItem key={ev} value={ev}>
                {formatEnumValue(ev)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {dataType === "bool" && (
        <div className="flex items-center gap-3">
          <Switch
            id={key}
            checked={value === true}
            onCheckedChange={(checked) => onChange(key, checked)}
          />
          <span className="text-sm text-muted-foreground">
            {value === true ? "Yes" : value === false ? "No" : "Not set"}
          </span>
        </div>
      )}
    </div>
  )
}

/** 1-5 score button row */
function ScoreButtons({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "w-10 h-10 rounded-md border text-sm font-medium transition-colors",
            value === n
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent border-input"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** Convert snake_case enum values to readable labels */
function formatEnumValue(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
