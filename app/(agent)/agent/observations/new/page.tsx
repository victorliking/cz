import { Suspense } from "react"
import { ObservationForm } from "./ObservationForm"

export default function NewObservationPage() {
  return (
    <Suspense fallback={<div className="p-10 text-[#86868b]">Loading...</div>}>
      <ObservationForm />
    </Suspense>
  )
}
