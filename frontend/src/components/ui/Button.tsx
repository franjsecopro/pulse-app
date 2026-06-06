import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'

/**
 * Thin wrapper around the native <button>.
 *
 * Intentionally has NO default styles, NO variants, and NO sizes. All visual
 * styling is controlled by the call site via `className`. This keeps the
 * migration from native <button> a pure mechanical rename.
 *
 * The only centralized behaviors are: `type` defaults to 'button',
 * `loading` toggles `disabled` + `aria-busy`, and `ref` is forwarded.
 * Spinners, icons, and loading text are the call site's responsibility.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { type = 'button', loading = false, disabled, className, children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={className}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  )
})
