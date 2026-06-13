/**
 * Bottom-pinned action row for mobile. Keeps CTAs above the OS home indicator.
 * On md+ renders as a normal static block (className merge allows layout overrides).
 */
export default function MobileStickyFooter({
  children,
  className = '',
  fixed = true,
  align = 'between',
}) {
  const alignClass =
    align === 'end'
      ? 'justify-end'
      : align === 'start'
        ? 'justify-start'
        : 'justify-between'

  const positionClass = fixed
    ? 'fixed inset-x-0 bottom-0 z-40 border-t border-[#333] bg-[#0a0a0a]/98 px-4 py-3 backdrop-blur-md md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none'
    : 'border-t border-[#333] bg-[#0a0a0a]/98 px-4 py-3 backdrop-blur-md shrink-0'

  return (
    <div className={`safe-bottom-bar ${positionClass} ${className}`.trim()}>
      <div className={`flex w-full items-center gap-3 ${alignClass} [&_button]:min-h-[44px] md:[&_button]:min-h-0`}>
        {children}
      </div>
    </div>
  )
}
