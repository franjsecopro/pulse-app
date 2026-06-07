import { useEffect, useState } from 'react'
import { alertsService } from '../services/alerts.service'
import type { Alert, AlertType } from '../types'

interface UseAlertsParams {
  month?: number
  year?: number
  types?: AlertType[]
  enabled?: boolean
}

export function useAlerts({ month, year, types, enabled = true }: UseAlertsParams) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Inline `types: [...]` at call sites is a new array ref every render — sort+join makes it a stable key.
  const typesKey = types ? [...types].sort().join(',') : ''

  // biome-ignore lint/correctness/useExhaustiveDependencies: typesKey is derived from types; using types directly would re-fire on every render (see typesKey comment above).
  useEffect(() => {
    if (!enabled) {
      setAlerts([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    alertsService
      .getAlerts({ month, year, types })
      .then(setAlerts)
      .finally(() => setIsLoading(false))
  }, [month, year, enabled, typesKey])

  return { alerts, isLoading, count: alerts.length }
}
