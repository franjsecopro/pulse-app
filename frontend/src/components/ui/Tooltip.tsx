import { cloneElement, type ReactElement, type ReactNode, useId } from 'react'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  position?: TooltipPosition
  className?: string
  children: ReactElement
}

const positionClasses: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
}

export function Tooltip({ content, position = 'top', className, children }: TooltipProps) {
  const id = useId()
  const trigger = cloneElement(children, { 'aria-describedby': id })

  return (
    <span className={`relative inline-block group ${className ?? ''}`.trim()}>
      {trigger}
      <span
        id={id}
        role='tooltip'
        className={[
          'absolute z-50',
          'px-2.5 py-1.5',
          'rounded-lg',
          'bg-slate-900 text-white text-xs font-medium whitespace-nowrap',
          'shadow-lg',
          'pointer-events-none',
          'invisible group-hover:visible group-focus:visible',
          positionClasses[position],
        ].join(' ')}
      >
        {content}
      </span>
    </span>
  )
}
