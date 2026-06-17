import { useCallback, useState } from 'react'
import {
  getNotificationsLogQueryKeys,
  getNotificationsPendingQueryKeys,
} from '../API/queryKeys/notifications/notificationsQueryKeys'
import { useTranslation } from '../i18n'
import { notificationsService } from '../services/notifications.service'
import type { AppNotification, NotificationLogFilters } from '../types'
import { addDaysISO, todayISO } from '../utils/formatters'
import { useMutationRequest, useQueryClient, useQueryRequest } from './reactQuery'

interface UsePendingNotificationsParams {
  /**
   * The day the user is sending notifications for. The backend filters by
   * ``classDate = date + 1`` (reminders go out the day before the class).
   */
  date: string
}

interface UsePendingNotificationsResult {
  notifications: AppNotification[]
  isLoading: boolean
  isGenerating: boolean
  generateError: string | null
  sentIds: Set<number>
  handleGenerate: () => Promise<void>
  handleSend: (notification: AppNotification) => Promise<void>
}

export function usePendingNotifications({
  date,
}: UsePendingNotificationsParams): UsePendingNotificationsResult {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [sentIds, setSentIds] = useState<Set<number>>(new Set())

  const targetDate = addDaysISO(date, 1)
  const isToday = date === todayISO()
  const pendingKey = getNotificationsPendingQueryKeys(date)

  const query = useQueryRequest({
    queryKey: pendingKey,
    // First visit of the day has nothing pending yet — generate transparently.
    queryFn: async () => {
      const items = await notificationsService.getPending(date)
      if (items.length === 0 && isToday) {
        return notificationsService.generate(targetDate)
      }
      return items
    },
  })

  const generateMutation = useMutationRequest({
    mutationFn: async () => {
      await notificationsService.generate(targetDate)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingKey }),
  })

  const sendMutation = useMutationRequest({
    mutationFn: (notification: AppNotification) => notificationsService.markSent(notification.id),
    // Optimistic: the user already jumped to WhatsApp — show "sent" immediately,
    // roll back if the server rejects the markSent.
    onMutate: async (notification) => {
      await queryClient.cancelQueries({ queryKey: pendingKey })
      const previous = queryClient.getQueryData<AppNotification[]>(pendingKey)
      queryClient.setQueryData<AppNotification[]>(pendingKey, (prev) =>
        prev?.map((item) => (item.id === notification.id ? { ...item, status: 'sent' } : item)),
      )
      setSentIds((prev) => new Set(prev).add(notification.id))
      return { previous }
    },
    onError: (_error, notification, context) => {
      if (context?.previous) queryClient.setQueryData(pendingKey, context.previous)
      setSentIds((prev) => {
        const next = new Set(prev)
        next.delete(notification.id)
        return next
      })
    },
  })

  const handleGenerate = useCallback(async () => {
    await generateMutation.mutateAsync().catch(() => undefined)
  }, [generateMutation.mutateAsync])

  const handleSend = useCallback(
    async (notification: AppNotification) => {
      if (!notification.whatsappUrl) return
      window.open(notification.whatsappUrl, '_blank', 'noopener,noreferrer')
      await sendMutation.mutateAsync(notification).catch(() => undefined)
    },
    [sendMutation.mutateAsync],
  )

  const generateError = generateMutation.error
    ? generateMutation.error.message || t('notifications.errors.generate')
    : query.error
      ? query.error.message || t('notifications.errors.load')
      : null

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    isGenerating: generateMutation.isPending,
    generateError,
    sentIds,
    handleGenerate,
    handleSend,
  }
}

interface UseNotificationLogResult {
  items: AppNotification[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  isLoading: boolean
}

export function useNotificationLog(filters: NotificationLogFilters): UseNotificationLogResult {
  // Inline `filters={{...}}` at call sites is fine: React Query hashes keys
  // deterministically, so an equal object is the same key.
  const query = useQueryRequest({
    queryKey: getNotificationsLogQueryKeys(filters),
    queryFn: () => notificationsService.getLog(filters),
  })

  const page = query.data

  return {
    items: page?.items ?? [],
    total: page?.total ?? 0,
    page: page?.page ?? filters.page,
    pageSize: page?.pageSize ?? filters.pageSize,
    pageCount: Math.max(1, Math.ceil((page?.total ?? 0) / (page?.pageSize ?? filters.pageSize))),
    isLoading: query.isLoading,
  }
}
