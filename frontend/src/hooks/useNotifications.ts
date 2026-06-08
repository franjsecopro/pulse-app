import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { notificationsService } from '../services/notifications.service'
import type { AppNotification, NotificationLogFilters, NotificationLogPage } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Adds ``days`` calendar days to an ISO date string and returns a new ISO date
 * string (``YYYY-MM-DD``). Uses local time so the user's "day" is respected
 * regardless of server timezone — the backend then handles timezone math.
 */
function addDaysISO(isoDate: string | undefined, days: number): string {
  if (!isoDate) return todayISO()
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setTime(d.getTime() + days * DAY_MS)
  const yyyy = d.getFullYear()
  const monthPadded = String(d.getMonth() + 1).padStart(2, '0')
  const dayPadded = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${monthPadded}-${dayPadded}`
}

function todayISO(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const monthPadded = String(now.getMonth() + 1).padStart(2, '0')
  const dayPadded = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${monthPadded}-${dayPadded}`
}

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
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<number>>(new Set())

  const targetDate = addDaysISO(date, 1)
  const isToday = date === todayISO()

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setGenerateError(null)

    const finishLoading = () => {
      if (!cancelled) setIsLoading(false)
    }

    notificationsService
      .getPending(date)
      .then((items) => {
        if (cancelled) return
        if (items.length === 0 && isToday) {
          notificationsService
            .generate(targetDate)
            .then((generated) => {
              if (!cancelled) setNotifications(generated)
            })
            .catch((err: unknown) => {
              if (!cancelled) {
                setGenerateError(
                  err instanceof Error ? err.message : t('notifications.errors.load'),
                )
              }
            })
            .finally(finishLoading)
        } else {
          setNotifications(items)
          finishLoading()
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGenerateError(err instanceof Error ? err.message : t('notifications.errors.load'))
          finishLoading()
        }
      })

    return () => {
      cancelled = true
    }
  }, [date, targetDate, isToday, t])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      await notificationsService.generate(targetDate)
      const fresh = await notificationsService.getPending(date)
      setNotifications(fresh)
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : t('notifications.errors.generate'))
    } finally {
      setIsGenerating(false)
    }
  }, [date, targetDate, t])

  const handleSend = useCallback(async (notification: AppNotification) => {
    if (!notification.whatsappUrl) return
    window.open(notification.whatsappUrl, '_blank', 'noopener,noreferrer')
    await notificationsService.markSent(notification.id)
    setSentIds((prev) => new Set(prev).add(notification.id))
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, status: 'sent' } : item)),
    )
  }, [])

  return {
    notifications,
    isLoading,
    isGenerating,
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
  const [page, setPage] = useState<NotificationLogPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Inline `filters={{...}}` at call sites is a new object ref every render — JSON.stringify gives a stable key.
  const filtersKey = JSON.stringify(filters)

  // biome-ignore lint/correctness/useExhaustiveDependencies: filtersKey is derived from filters; using filters directly would re-fire on every render (see filtersKey comment above).
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    notificationsService
      .getLog(filters)
      .then((result) => {
        if (!cancelled) setPage(result)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filtersKey])

  return {
    items: page?.items ?? [],
    total: page?.total ?? 0,
    page: page?.page ?? filters.page,
    pageSize: page?.pageSize ?? filters.pageSize,
    pageCount: Math.max(1, Math.ceil((page?.total ?? 0) / (page?.pageSize ?? filters.pageSize))),
    isLoading,
  }
}
