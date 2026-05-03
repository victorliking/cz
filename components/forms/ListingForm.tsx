"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { getByGroup, type Group, GROUPS } from "@/lib/vector-schema"
import { DimensionInput } from "@/components/forms/DimensionInput"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const PROPERTY_TYPES = [
  { value: "SFH", label: "Single Family" },
  { value: "CONDO", label: "Condo" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "COOP", label: "Co-op" },
  { value: "MULTIFAMILY", label: "Multi-family" },
]

// Steps for the multi-step form
const STEPS = [
  { key: "basics", label: "Basics", groups: [] as Group[] },
  { key: "building", label: "Building", groups: ["building"] as Group[] },
  { key: "layout", label: "Layout", groups: ["layout"] as Group[] },
  { key: "sensory", label: "Sensory", groups: ["sensory"] as Group[] },
  { key: "outdoor", label: "Outdoor & Neighborhood", groups: ["outdoor", "neighborhood"] as Group[] },
  { key: "notes", label: "Notes", groups: [] as Group[] },
]

// Sensory prompts to help agents give thoughtful scores
const SENSORY_PROMPTS: Record<string, string> = {
  natural_light: "Stand in the living room — how would you rate the natural light?",
  view_quality: "Look out the main windows — what's the view like?",
  privacy_from_neighbors: "How does the privacy from neighbors feel — exposed or private?",
  finish_quality: "Look at the counters, cabinets, fixtures — what level of finish?",
  move_in_readiness: "Could someone move in tomorrow, or does it need work?",
}

interface ListingFormData {
  // Basics
  address: string
  city: string
  state: string
  zipCode: string
  listPrice: number | null
  propertyType: string
  bedrooms: number | null
  bathroomsFull: number | null
  bathroomsHalf: number | null
  interiorSqft: number | null
  lotSqft: number | null
  yearBuilt: number | null
  yearRenovated: number | null
  hoaFeeMonthly: number | null
  propertyTaxAnnual: number | null
  listingUrl: string
  // Vector dimensions
  vector: Record<string, unknown>
  // Notes
  agentNotes: string
}

const initialFormData: ListingFormData = {
  address: "",
  city: "",
  state: "",
  zipCode: "",
  listPrice: null,
  propertyType: "",
  bedrooms: null,
  bathroomsFull: null,
  bathroomsHalf: null,
  interiorSqft: null,
  lotSqft: null,
  yearBuilt: null,
  yearRenovated: null,
  hoaFeeMonthly: null,
  propertyTaxAnnual: null,
  listingUrl: "",
  vector: {},
  agentNotes: "",
}

interface ListingFormProps {
  initialData?: Partial<ListingFormData>
  onSubmit: (data: ListingFormData) => Promise<void>
  mode?: "create" | "edit"
}

export function ListingForm({ initialData, onSubmit, mode = "create" }: ListingFormProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<ListingFormData>({
    ...initialFormData,
    ...initialData,
  })
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-save with 800ms debounce
  const autoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      // In a real implementation, this would save draft to API
      setLastSaved(new Date())
    }, 800)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const updateField = (field: keyof ListingFormData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }))
    autoSave()
  }

  const updateVector = (key: string, value: unknown) => {
    setData((prev) => ({
      ...prev,
      vector: { ...prev.vector, [key]: value },
    }))
    autoSave()
  }

  // Calculate completeness per step
  const getStepCompleteness = (stepIdx: number): number => {
    const s = STEPS[stepIdx]
    if (s.key === "basics") {
      const fields = [data.address, data.city, data.state, data.zipCode, data.listPrice, data.propertyType, data.bedrooms, data.bathroomsFull]
      const filled = fields.filter((f) => f !== null && f !== "" && f !== undefined)
      return Math.round((filled.length / fields.length) * 100)
    }
    if (s.key === "notes") return data.agentNotes ? 100 : 0
    // For dimension groups
    const dims = s.groups.flatMap((g) => getByGroup(g))
    if (dims.length === 0) return 0
    const filled = dims.filter((d) => data.vector[d.key] !== null && data.vector[d.key] !== undefined)
    return Math.round((filled.length / dims.length) * 100)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSubmit(data)
    } finally {
      setSaving(false)
    }
  }

  const currentStep = STEPS[step]

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors",
              i === step
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-accent"
            )}
          >
            {s.label}
            <Badge variant="secondary" className="text-xs">
              {getStepCompleteness(i)}%
            </Badge>
          </button>
        ))}
      </div>

      {/* Auto-save indicator */}
      {lastSaved && (
        <p className="text-xs text-muted-foreground mb-4">
          Draft saved {lastSaved.toLocaleTimeString()}
        </p>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStep.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* BASICS STEP */}
          {currentStep.key === "basics" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={data.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={data.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Seattle"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={data.state}
                      onChange={(e) => updateField("state", e.target.value)}
                      placeholder="WA"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">Zip *</Label>
                    <Input
                      id="zipCode"
                      value={data.zipCode}
                      onChange={(e) => updateField("zipCode", e.target.value)}
                      placeholder="98103"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div>
                  <Label htmlFor="listPrice">List Price *</Label>
                  <Input
                    id="listPrice"
                    type="number"
                    value={data.listPrice ?? ""}
                    onChange={(e) => updateField("listPrice", e.target.value ? Number(e.target.value) : null)}
                    placeholder="550000"
                  />
                </div>
                <div>
                  <Label htmlFor="propertyType">Property Type *</Label>
                  <Select
                    value={data.propertyType}
                    onValueChange={(v) => updateField("propertyType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div>
                  <Label htmlFor="bedrooms">Bedrooms *</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={data.bedrooms ?? ""}
                    onChange={(e) => updateField("bedrooms", e.target.value ? Number(e.target.value) : null)}
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="bathroomsFull">Full Baths *</Label>
                  <Input
                    id="bathroomsFull"
                    type="number"
                    value={data.bathroomsFull ?? ""}
                    onChange={(e) => updateField("bathroomsFull", e.target.value ? Number(e.target.value) : null)}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="bathroomsHalf">Half Baths</Label>
                  <Input
                    id="bathroomsHalf"
                    type="number"
                    value={data.bathroomsHalf ?? ""}
                    onChange={(e) => updateField("bathroomsHalf", e.target.value ? Number(e.target.value) : null)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                <div>
                  <Label htmlFor="interiorSqft">Interior sqft</Label>
                  <Input
                    id="interiorSqft"
                    type="number"
                    value={data.interiorSqft ?? ""}
                    onChange={(e) => updateField("interiorSqft", e.target.value ? Number(e.target.value) : null)}
                    placeholder="1800"
                  />
                </div>
                <div>
                  <Label htmlFor="lotSqft">Lot sqft</Label>
                  <Input
                    id="lotSqft"
                    type="number"
                    value={data.lotSqft ?? ""}
                    onChange={(e) => updateField("lotSqft", e.target.value ? Number(e.target.value) : null)}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label htmlFor="yearBuilt">Year Built</Label>
                  <Input
                    id="yearBuilt"
                    type="number"
                    value={data.yearBuilt ?? ""}
                    onChange={(e) => updateField("yearBuilt", e.target.value ? Number(e.target.value) : null)}
                    placeholder="1955"
                  />
                </div>
                <div>
                  <Label htmlFor="yearRenovated">Renovated</Label>
                  <Input
                    id="yearRenovated"
                    type="number"
                    value={data.yearRenovated ?? ""}
                    onChange={(e) => updateField("yearRenovated", e.target.value ? Number(e.target.value) : null)}
                    placeholder="2020"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                <div>
                  <Label htmlFor="hoaFeeMonthly">HOA/month</Label>
                  <Input
                    id="hoaFeeMonthly"
                    type="number"
                    value={data.hoaFeeMonthly ?? ""}
                    onChange={(e) => updateField("hoaFeeMonthly", e.target.value ? Number(e.target.value) : null)}
                    placeholder="350"
                  />
                </div>
                <div>
                  <Label htmlFor="propertyTaxAnnual">Tax/year</Label>
                  <Input
                    id="propertyTaxAnnual"
                    type="number"
                    value={data.propertyTaxAnnual ?? ""}
                    onChange={(e) => updateField("propertyTaxAnnual", e.target.value ? Number(e.target.value) : null)}
                    placeholder="6000"
                  />
                </div>
                <div>
                  <Label htmlFor="listingUrl">Listing URL</Label>
                  <Input
                    id="listingUrl"
                    type="url"
                    value={data.listingUrl}
                    onChange={(e) => updateField("listingUrl", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </>
          )}

          {/* DIMENSION GROUP STEPS */}
          {currentStep.groups.length > 0 && (
            <div className="space-y-6">
              {currentStep.groups.map((group) => {
                const dims = getByGroup(group)
                return (
                  <div key={group}>
                    {currentStep.groups.length > 1 && (
                      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
                        {group}
                      </h3>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dims.map((dim) => (
                        <div key={dim.key}>
                          {SENSORY_PROMPTS[dim.key] && (
                            <p className="text-xs text-muted-foreground italic mb-1">
                              {SENSORY_PROMPTS[dim.key]}
                            </p>
                          )}
                          <DimensionInput
                            dimension={dim}
                            value={data.vector[dim.key] ?? null}
                            onChange={updateVector}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* NOTES STEP */}
          {currentStep.key === "notes" && (
            <div>
              <Label htmlFor="agentNotes">Agent Notes</Label>
              <textarea
                id="agentNotes"
                value={data.agentNotes}
                onChange={(e) => updateField("agentNotes", e.target.value)}
                placeholder="Any observations, quirks, or context about this listing..."
                className="w-full mt-1 min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Next →
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : mode === "edit" ? "Update Listing" : "Create Listing"}
          </Button>
        )}
      </div>
    </div>
  )
}
