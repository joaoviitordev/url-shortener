import { type FormEvent, useEffect, useState } from 'react'

import { useShortenUrl } from './hooks/use-shorten-url'

const COPIED_FEEDBACK_MS = 2000

const withProtocol = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`

function App() {
  const [longUrl, setLongUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const { mutate, data, error, isPending, isSuccess, isError, reset } =
    useShortenUrl()

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUrl = longUrl.trim()
    if (!trimmedUrl) return
    setCopied(false)
    mutate(withProtocol(trimmedUrl))
  }

  const handleCopy = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.shortUrl)
    setCopied(true)
  }

  const handleNewUrl = () => {
    reset()
    setLongUrl('')
    setCopied(false)
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl"
      />

      <section className="relative w-full max-w-xl">
        <header className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Rápido, simples e gratuito
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            URL{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Shortener
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-zinc-400">
            Transforme links longos em URLs curtas e fáceis de compartilhar.
            Cole o endereço abaixo e receba seu link encurtado na hora.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 shadow-2xl shadow-black/40 backdrop-blur sm:flex-row"
        >
          <label htmlFor="long-url" className="sr-only">
            URL para encurtar
          </label>
          <input
            id="long-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoFocus
            required
            placeholder="https://exemplo.com/um-link-muito-longo"
            value={longUrl}
            onChange={(event) => {
              setLongUrl(event.target.value)
              if (isError) reset()
            }}
            disabled={isPending}
            aria-invalid={isError}
            aria-describedby={isError ? 'shorten-error' : undefined}
            className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isPending || !longUrl.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {isPending ? 'Encurtando...' : 'Encurtar'}
          </button>
        </form>

        <div aria-live="polite" className="mt-4 min-h-6">
          {isPending && (
            <p className="text-center text-sm text-zinc-500">
              A primeira requisição pode levar alguns segundos enquanto o
              servidor acorda.
            </p>
          )}

          {isError && (
            <p
              id="shorten-error"
              role="alert"
              className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300"
            >
              {error.message}
            </p>
          )}

          {isSuccess && (
            <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4">
              <p className="text-xs font-medium tracking-wide text-emerald-400 uppercase">
                Sua URL encurtada
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={data.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-lg font-semibold text-white hover:text-violet-300"
                >
                  {data.shortUrl}
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p
                className="mt-3 truncate text-sm text-zinc-500"
                title={data.longUrl}
              >
                Original: {data.longUrl}
              </p>
              <button
                type="button"
                onClick={handleNewUrl}
                className="mt-4 text-sm font-medium text-violet-400 hover:text-violet-300"
              >
                Encurtar outra URL
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
