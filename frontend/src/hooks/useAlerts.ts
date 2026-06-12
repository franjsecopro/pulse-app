import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { alertsService } from '../services/alerts.service'
import type { AlertType } from '../types'

interface UseAlertsParams {
  month?: number
  year?: number
  types?: AlertType[]
  enabled?: boolean
}

export function useAlerts({ month, year, types, enabled = true }: UseAlertsParams) {
  const query = useQuery({
    queryKey: queryKeys.alerts.list({ month, year, types }),
    queryFn: () => alertsService.getAlerts({ month, year, types }),
    enabled,
  })

  const alerts = enabled ? (query.data ?? []) : []

  return { alerts, isLoading: enabled && query.isLoading, count: alerts.length }
}
