import type { Theme } from '../hooks/use-theme'
import { MoonIcon, SunIcon } from './icons'

type ThemeToggleProps = {
  theme: Theme
  onToggle: () => void
}

const iconClassName = (visible: boolean) =>
  `[grid-area:1/1] size-[18px] transition duration-500 ease-fluid motion-reduce:transition-opacity motion-reduce:duration-200 ${
    visible
      ? 'rotate-0 scale-100 opacity-100'
      : '-rotate-90 scale-50 opacity-0 motion-reduce:rotate-0 motion-reduce:scale-100'
  }`

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark'
  const label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="material fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-10 grid size-10 place-items-center rounded-full border border-hairline text-ink transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-90"
    >
      <SunIcon className={iconClassName(!isDark)} />
      <MoonIcon className={iconClassName(isDark)} />
    </button>
  )
}
