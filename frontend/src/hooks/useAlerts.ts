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
  }, [month, year, enabled, types])

  return { alerts, isLoading, count: alerts.length }
}
