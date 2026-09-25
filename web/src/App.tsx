import { type FormEvent, useEffect, useRef, useState } from 'react'

import { AlertIcon } from './components/icons'
import { ShortenedLink } from './components/shortened-link'
import { ThemeToggle } from './components/theme-toggle'
import { useShortenUrl } from './hooks/use-shorten-url'
import { useTheme } from './hooks/use-theme'

const SLOW_REQUEST_MS = 1500

const withProtocol = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`

function App() {
  const [longUrl, setLongUrl] = useState('')
  const [isSlow, setIsSlow] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme, toggleTheme } = useTheme()
  const { mutate, data, error, isPending, isSuccess, isError, reset } =
    useShortenUrl()

  useEffect(() => {
    if (!isPending) return
    const timeout = setTimeout(() => setIsSlow(true), SLOW_REQUEST_MS)
    return () => {
      clearTimeout(timeout)
      setIsSlow(false)
    }
  }, [isPending])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUrl = longUrl.trim()
    if (!trimmedUrl) return
    mutate(withProtocol(trimmedUrl))
  }

  const handleReset = () => {
    reset()
    setLongUrl('')
    inputRef.current?.focus()
  }

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <main className="mx-auto flex min-h-dvh w-full max-w-[40rem] flex-col justify-center px-6 py-24">
        <h1 className="text-[clamp(2.75rem,9vw,4.5rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
          Encurte qualquer link.
        </h1>
        <p className="mt-5 max-w-[40ch] text-[19px] leading-[1.45] text-ink-secondary">
          Cole o endereço completo e receba um link curto, pronto para copiar e
          compartilhar.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex items-center gap-2 rounded-[1.375rem] bg-fill p-1.5 pl-5 ring-transparent ring-inset transition-shadow focus-within:ring-[1.5px] focus-within:ring-ink/50"
        >
          <label htmlFor="long-url" className="sr-only">
            Endereço para encurtar
          </label>
          <input
            ref={inputRef}
            id="long-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            placeholder="https://exemplo.com/um-endereco-longo"
            value={longUrl}
            onChange={(event) => {
              setLongUrl(event.target.value)
              if (isError) reset()
            }}
            disabled={isPending}
            aria-invalid={isError}
            aria-describedby={isError ? 'shorten-error' : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-secondary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isPending || !longUrl.trim()}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas transition-transform duration-100 ease-out hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100"
          >
            {isPending && (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {isPending ? 'Encurtando' : 'Encurtar'}
          </button>
        </form>

        <div aria-live="polite">
          {isSlow && (
            <p className="mt-4 animate-fade-in text-sm text-ink-secondary">
              O servidor está iniciando. Na primeira vez, isso pode levar até um
              minuto.
            </p>
          )}

          {isError && (
            <p
              id="shorten-error"
              role="alert"
              className="mt-4 flex animate-fade-in items-start gap-2 text-[15px] text-ink"
            >
              <AlertIcon className="mt-0.5 size-[18px] shrink-0" />
              {error.message}
            </p>
          )}

          {isSuccess && (
            <ShortenedLink
              key={data.shortCode}
              link={data}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
    </>
  )
}

export default App
