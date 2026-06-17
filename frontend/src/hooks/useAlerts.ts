import { getAlertsListQueryKeys } from '../API/queryKeys/alerts/alertsQueryKeys'
import { alertsService } from '../services/alerts.service'
import type { AlertType } from '../types'
import { useQueryRequest } from './reactQuery'

interface UseAlertsParams {
  month?: number
  year?: number
  types?: AlertType[]
  enabled?: boolean
}

export function useAlerts({ month, year, types, enabled = true }: UseAlertsParams) {
  const query = useQueryRequest({
    queryKey: getAlertsListQueryKeys({ month, year, types }),
    queryFn: () => alertsService.getAlerts({ month, year, types }),
    enabled,
  })

  const alerts = enabled ? (query.data ?? []) : []

  return { alerts, isLoading: enabled && query.isLoading, count: alerts.length }
}
