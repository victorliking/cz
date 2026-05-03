"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { ACTIVE_QUESTIONS, type IntakeQuestion } from "@/lib/questionnaire/intake-schema"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { calculatePerCity, MA_TAX_RATES, type CityAffordability } from "@/lib/financial/affordability"

interface IntakeWizardProps {
  buyerProfileId: string
  onComplete: (answers: Record<string, unknown>) => Promise<void>
}

export function IntakeWizard({ buyerProfileId, onComplete }: IntakeWizardProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const startTime = useRef(Date.now())

  const question = ACTIVE_QUESTIONS[step]
  const progress = ((step + 1) / ACTIVE_QUESTIONS.length) * 100

  const setAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const canAdvance = () => {
    if (!question.required) return true
    const val = answers[question.id]
    if (val === undefined || val === null || val === "") return false
    if (Array.isArray(val) && val.length === 0) return false
    return true
  }

  const handleNext = () => {
    if (step < ACTIVE_QUESTIONS.length - 1) {
      setStep((s) => s + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const duration = Math.round((Date.now() - startTime.current) / 1000)
    try {
      await onComplete({ ...answers, _durationSeconds: duration })
    } finally {
      setSubmitting(false)
    }
  }

  const isLast = step === ACTIVE_QUESTIONS.length - 1

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="text-sm text-slate-500 hover:text-slate-900 disabled:invisible"
          >
            ← Back
          </button>
          <span className="text-xs text-slate-400">
            {step + 1} of {ACTIVE_QUESTIONS.length}
          </span>
          {!question.required && !isLast && (
            <button
              onClick={handleNext}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Skip →
            </button>
          )}
          {question.required && <div className="w-12" />}
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {question.label}
        </h2>
        {question.subtitle && (
          <p className="text-slate-500 mb-6">{question.subtitle}</p>
        )}

        <div className="flex-1 flex flex-col justify-center">
          <QuestionRenderer
            question={question}
            value={answers[question.id]}
            onChange={(val) => setAnswer(question.id, val)}
          />
        </div>

        {/* Immediate value feedback */}
        {question.immediateValueTemplate && answers[question.id] && (
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700">
              💡 {question.immediateValueTemplate as string}
            </p>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="sticky bottom-0 bg-white border-t p-4">
        {isLast ? (
          <Button
            className="w-full h-12 text-base"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Complete Intake →"}
          </Button>
        ) : (
          <Button
            className="w-full h-12 text-base"
            onClick={handleNext}
            disabled={!canAdvance()}
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  )
}

// --- Question Renderer ---

function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion
  value: unknown
  onChange: (val: unknown) => void
}) {
  switch (question.type) {
    case "dual_slider":
      return <DualSliderInput value={value as [number, number] | undefined} onChange={onChange} />
    case "affordability":
      return <AffordabilityInput value={value as AffordabilityData | undefined} onChange={onChange} />
    case "chip_single":
      return <ChipSingleInput options={question.options || []} value={value as string | undefined} onChange={onChange} />
    case "chip_multi":
      return <ChipMultiInput options={question.options || []} value={value as string[] | undefined} onChange={onChange} maxSelections={question.maxSelections} />
    case "multi_input":
      return <MultiInput value={value as string[] | undefined} onChange={onChange} />
    case "repeater":
      return <RepeaterInput value={value as string[] | undefined} onChange={onChange} />
    case "ranking":
      return <RankingInput options={question.options || []} value={value as string[] | undefined} onChange={onChange} />
    case "open_text":
      return <OpenTextInput value={value as { threeWords?: string; anythingElse?: string } | undefined} onChange={onChange} />
    default:
      return <p>Unknown question type</p>
  }
}

// --- Input Components ---

function DualSliderInput({
  value,
  onChange,
}: {
  value?: [number, number]
  onChange: (val: [number, number]) => void
}) {
  const [range, setRange] = useState<[number, number]>(value || [400000, 700000])

  const update = (idx: number, val: number) => {
    const newRange: [number, number] = [...range] as [number, number]
    newRange[idx] = val
    if (newRange[0] > newRange[1]) return
    setRange(newRange)
    onChange(newRange)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between text-lg font-semibold text-slate-900">
        <span>${(range[0] / 1000).toFixed(0)}k</span>
        <span>—</span>
        <span>${(range[1] / 1000).toFixed(0)}k</span>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-500">Minimum</label>
          <input
            type="range"
            min={100000}
            max={2000000}
            step={25000}
            value={range[0]}
            onChange={(e) => update(0, Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Maximum</label>
          <input
            type="range"
            min={100000}
            max={2000000}
            step={25000}
            value={range[1]}
            onChange={(e) => update(1, Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </div>
  )
}

function ChipSingleInput({
  options,
  value,
  onChange,
}: {
  options: string[]
  value?: string
  onChange: (val: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-4 py-3 rounded-full border text-sm font-medium transition-all",
            value === opt
              ? "bg-blue-500 text-white border-blue-500 shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function ChipMultiInput({
  options,
  value,
  onChange,
  maxSelections,
}: {
  options: string[]
  value?: string[]
  onChange: (val: string[]) => void
  maxSelections?: number
}) {
  const selected = value || []

  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt))
    } else {
      if (maxSelections && selected.length >= maxSelections) return
      onChange([...selected, opt])
    }
  }

  return (
    <div className="space-y-3">
      {maxSelections && (
        <p className="text-xs text-slate-400">{selected.length}/{maxSelections} selected</p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "px-4 py-3 rounded-full border text-sm font-medium transition-all text-left",
              selected.includes(opt)
                ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50",
              maxSelections && selected.length >= maxSelections && !selected.includes(opt)
                ? "opacity-40 cursor-not-allowed"
                : ""
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiInput({
  value,
  onChange,
}: {
  value?: string[]
  onChange: (val: string[]) => void
}) {
  const [input, setInput] = useState("")
  const items = value || []

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
      setInput("")
    }
  }

  const remove = (item: string) => {
    onChange(items.filter((i) => i !== item))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Type a city or neighborhood..."
          className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button type="button" variant="outline" onClick={add} className="shrink-0">
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm flex items-center gap-1">
              {item}
              <button onClick={() => remove(item)} className="text-blue-400 hover:text-blue-700">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RepeaterInput({
  value,
  onChange,
}: {
  value?: string[]
  onChange: (val: string[]) => void
}) {
  const [input, setInput] = useState("")
  const items = value || []

  const add = () => {
    const trimmed = input.trim()
    if (trimmed) {
      onChange([...items, trimmed])
      setInput("")
    }
  }

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Address (e.g., 100 Federal St, Boston)"
          className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button type="button" variant="outline" onClick={add} className="shrink-0">
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">{item}</span>
              <button onClick={() => remove(idx)} className="text-slate-400 hover:text-red-500 text-sm">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RankingInput({
  options,
  value,
  onChange,
}: {
  options: string[]
  value?: string[]
  onChange: (val: string[]) => void
}) {
  const items = value || [...options]

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const newItems = [...items]
    ;[newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]]
    onChange(newItems)
  }

  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return
    const newItems = [...items]
    ;[newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]]
    onChange(newItems)
  }

  // Initialize on first render
  if (!value) {
    onChange([...options])
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={item}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
        >
          <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
            {idx + 1}
          </span>
          <span className="flex-1 text-sm font-medium">{item}</span>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => moveUp(idx)}
              disabled={idx === 0}
              className="text-slate-400 hover:text-slate-700 disabled:invisible text-xs px-1"
            >
              ▲
            </button>
            <button
              onClick={() => moveDown(idx)}
              disabled={idx === items.length - 1}
              className="text-slate-400 hover:text-slate-700 disabled:invisible text-xs px-1"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Affordability Calculator Input ---

interface AffordabilityData {
  monthlyPayment: number
  downPayment: number
  interestRate: number
  budgetRange: [number, number]
  cityBreakdown?: CityAffordability[]
}

interface LoanOption {
  label: string
  rate: number
  desc: string
}

// Default loan options (used before live rates load)
const DEFAULT_LOAN_OPTIONS: LoanOption[] = [
  { label: "30yr Fixed", rate: 6.85, desc: "Most common" },
  { label: "15yr Fixed", rate: 6.10, desc: "Higher payment, less interest" },
  { label: "7/1 ARM", rate: 6.35, desc: "Lower initial rate" },
  { label: "FHA 30yr", rate: 6.50, desc: "Low down payment OK" },
  { label: "VA 30yr", rate: 6.25, desc: "Veterans, no PMI" },
]

function AffordabilityInput({
  value,
  onChange,
}: {
  value?: AffordabilityData
  onChange: (val: AffordabilityData) => void
}) {
  const [monthlyMin, setMonthlyMin] = useState(value?.monthlyPayment || 3000)
  const [monthlyMax, setMonthlyMax] = useState(4500)
  const [downMin, setDownMin] = useState(value?.downPayment || 100000)
  const [downMax, setDownMax] = useState(200000)
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>(DEFAULT_LOAN_OPTIONS)
  const [selectedLoan, setSelectedLoan] = useState<LoanOption>(DEFAULT_LOAN_OPTIONS[0])
  const [rateSource, setRateSource] = useState<string>("")
  const [rateAsOf, setRateAsOf] = useState<string>("")

  // Fetch live rates on mount
  useEffect(() => {
    fetch("/api/rates")
      .then((res) => res.json())
      .then((data) => {
        if (data.thirtyYearFixed) {
          const live: LoanOption[] = [
            { label: "30yr Fixed", rate: data.thirtyYearFixed, desc: "Most common" },
            { label: "15yr Fixed", rate: data.fifteenYearFixed, desc: "Higher payment, less interest" },
            { label: "7/1 ARM", rate: data.sevenOneArm, desc: "Lower initial rate" },
            { label: "FHA 30yr", rate: data.fhaThirtyYear, desc: "Low down payment OK" },
            { label: "VA 30yr", rate: data.vaThirtyYear, desc: "Veterans, no PMI" },
          ]
          setLoanOptions(live)
          setSelectedLoan(live[0])
          setRateSource(data.source || "")
          setRateAsOf(data.asOf || "")
        }
      })
      .catch(() => {/* use defaults */})
  }, [])

  const rate = selectedLoan.rate

  // Use the max values for calculation (stretch scenario)
  const cityResults = useMemo(() => {
    return calculatePerCity({
      monthlyPaymentComfort: monthlyMax,
      downPayment: downMax,
      interestRate: rate / 100,
      targetCities: Object.keys(MA_TAX_RATES),
    })
  }, [monthlyMax, downMax, rate])

  const cityResultsComfort = useMemo(() => {
    return calculatePerCity({
      monthlyPaymentComfort: monthlyMin,
      downPayment: downMin,
      interestRate: rate / 100,
      targetCities: Object.keys(MA_TAX_RATES),
    })
  }, [monthlyMin, downMin, rate])

  const avgMax = useMemo(() => {
    if (cityResults.length === 0) return 0
    return Math.round(cityResults.reduce((s, c) => s + c.maxPrice, 0) / cityResults.length)
  }, [cityResults])

  const avgComfort = useMemo(() => {
    if (cityResultsComfort.length === 0) return 0
    return Math.round(cityResultsComfort.reduce((s, c) => s + c.maxPrice, 0) / cityResultsComfort.length)
  }, [cityResultsComfort])

  // Emit change on any update
  const emitChange = useCallback((mMin: number, mMax: number, dMin: number, dMax: number, r: number) => {
    const results = calculatePerCity({
      monthlyPaymentComfort: mMax,
      downPayment: dMax,
      interestRate: r / 100,
      targetCities: Object.keys(MA_TAX_RATES),
    })
    const comfortResults = calculatePerCity({
      monthlyPaymentComfort: mMin,
      downPayment: dMin,
      interestRate: r / 100,
      targetCities: Object.keys(MA_TAX_RATES),
    })
    const avg = Math.round(results.reduce((s, c) => s + c.maxPrice, 0) / results.length)
    const avgC = Math.round(comfortResults.reduce((s, c) => s + c.maxPrice, 0) / comfortResults.length)
    onChange({
      monthlyPayment: mMax,
      downPayment: dMax,
      interestRate: r,
      budgetRange: [avgC, avg],
      cityBreakdown: results,
    })
  }, [onChange])

  return (
    <div className="space-y-5">
      {/* Monthly payment range */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">Monthly payment range</label>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <span className="text-xs text-slate-500">Comfortable</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                type="number" min={500} max={50000} step={100} value={monthlyMin}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setMonthlyMin(v)
                  emitChange(v, Math.max(v, monthlyMax), downMin, downMax, rate)
                }}
                className="w-full pl-7 pr-3 py-2 rounded-md border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500">Maximum</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                type="number" min={500} max={50000} step={100} value={monthlyMax}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setMonthlyMax(v)
                  emitChange(monthlyMin, Math.max(v, monthlyMin), downMin, downMax, rate)
                }}
                className="w-full pl-7 pr-3 py-2 rounded-md border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">Per month, including principal, interest, tax & insurance</p>
      </div>

      {/* Down payment range */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">Down payment range</label>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <span className="text-xs text-slate-500">Comfortable</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                type="number" min={0} max={5000000} step={5000} value={downMin}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setDownMin(v)
                  emitChange(monthlyMin, monthlyMax, v, Math.max(v, downMax), rate)
                }}
                className="w-full pl-7 pr-3 py-2 rounded-md border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500">Maximum</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                type="number" min={0} max={5000000} step={5000} value={downMax}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setDownMax(v)
                  emitChange(monthlyMin, monthlyMax, downMin, Math.max(v, downMin), rate)
                }}
                className="w-full pl-7 pr-3 py-2 rounded-md border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">Cash available for down payment at closing</p>
      </div>

      {/* Loan type selection */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">Loan type (current market rates)</label>
        <div className="grid grid-cols-1 gap-2">
          {loanOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setSelectedLoan(opt)
                emitChange(monthlyMin, monthlyMax, downMin, downMax, opt.rate)
              }}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all",
                selectedLoan.label === opt.label
                  ? "bg-blue-50 border-blue-500 text-blue-900"
                  : "bg-white border-slate-200 text-slate-700 hover:border-blue-200"
              )}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-slate-400">{opt.desc}</span>
              </div>
              <span className="font-bold text-base">{opt.rate}%</span>
            </button>
          ))}
        </div>
        {rateSource && (
          <p className="text-xs text-slate-400 mt-2">
            📊 Source: {rateSource}{rateAsOf ? ` (week of ${rateAsOf})` : ""}
          </p>
        )}
      </div>

      {/* Results */}
      {avgMax > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-semibold text-green-800">
              💰 Your buying power
            </p>
            <div className="text-right">
              <span className="text-xs text-slate-500">Comfortable: </span>
              <span className="text-sm font-bold text-green-700">${(avgComfort / 1000).toFixed(0)}k</span>
              <span className="text-xs text-slate-400 mx-1">→</span>
              <span className="text-xs text-slate-500">Stretch: </span>
              <span className="text-sm font-bold text-green-900">${(avgMax / 1000).toFixed(0)}k</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-4 gap-1 text-xs font-medium text-slate-500 px-2">
              <span>City</span>
              <span className="text-right">Comfort</span>
              <span className="text-right">Stretch</span>
              <span className="text-right">Tax</span>
            </div>
            {cityResults.map((c, i) => (
              <div key={c.city} className="grid grid-cols-4 gap-1 text-xs p-2 bg-white rounded-md">
                <span className="text-slate-700 font-medium">{c.city}</span>
                <span className="text-slate-600 text-right">${(cityResultsComfort[i]?.maxPrice / 1000 || 0).toFixed(0)}k</span>
                <span className="font-semibold text-slate-900 text-right">${(c.maxPrice / 1000).toFixed(0)}k</span>
                <span className="text-slate-400 text-right">{(c.taxRate / 10).toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-green-600">
            {selectedLoan.label} at {rate}% · Includes tax, insurance{downMin / avgComfort < 0.2 ? ", PMI" : ""}
          </p>
        </div>
      )}
    </div>
  )
}

function OpenTextInput({
  value,
  onChange,
}: {
  value?: { threeWords?: string; anythingElse?: string }
  onChange: (val: { threeWords?: string; anythingElse?: string }) => void
}) {
  const data = value || {}

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Describe your dream home in three words:
        </label>
        <input
          value={data.threeWords || ""}
          onChange={(e) => onChange({ ...data, threeWords: e.target.value })}
          placeholder="e.g., bright, peaceful, spacious"
          className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Anything else we should know?
        </label>
        <textarea
          value={data.anythingElse || ""}
          onChange={(e) => onChange({ ...data, anythingElse: e.target.value })}
          placeholder="Dealbreakers, must-haves, lifestyle context..."
          rows={4}
          className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  )
}
