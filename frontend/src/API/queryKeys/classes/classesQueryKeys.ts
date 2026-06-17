import { hasValidFilters } from '../hasValidFilters'
import { classesKeys } from './classesKeys'

export interface ClassesListFilters {
  month: number
  year: number
  clientId?: number
  page: number
}

export interface ClassesStatsFilters {
  month: number
  year: number
  clientId?: number
}

export const getClassesAllQueryKeys = () => {
  const { all } = classesKeys
  return [...all]
}

export const getClassesListQueryKeys = (filters: ClassesListFilters) => {
  const { list } = classesKeys
  const query: unknown[] = [...list]
  if (hasValidFilters(filters)) query.push(filters)
  return query
}

export const getClassesStatsQueryKeys = (filters: ClassesStatsFilters) => {
  const { stats } = classesKeys
  const query: unknown[] = [...stats]
  if (hasValidFilters(filters)) query.push(filters)
  return query
}
