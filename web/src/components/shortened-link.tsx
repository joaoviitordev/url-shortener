import { useEffect, useRef, useState } from 'react'

import type { ShortenedUrl } from '../lib/api'
import { ArrowUpRightIcon, CheckIcon, CopyIcon } from './icons'

const COPIED_FEEDBACK_MS = 2000

type CopyStatus = 'idle' | 'copied' | 'failed'

type ShortenedLinkProps = {
  link: ShortenedUrl
  onReset: () => void
}

const hostPrefix = ({ shortUrl, shortCode }: ShortenedUrl) =>
  shortUrl.slice(0, -shortCode.length).replace(/^https?:\/\//, '')

export function ShortenedLink({ link, onReset }: ShortenedLinkProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const sectionRef = useRef<HTMLElement>(null)
  const fallbackInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    sectionRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [])

  useEffect(() => {
    if (copyStatus === 'failed') {
      fallbackInputRef.current?.focus()
      fallbackInputRef.current?.select()
      return
    }
    if (copyStatus !== 'copied') return
    const timeout = setTimeout(() => setCopyStatus('idle'), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timeout)
  }, [copyStatus])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link.shortUrl)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="short-link-label"
      className="mt-16 animate-materialize motion-reduce:animate-fade-in"
    >
      <p id="short-link-label" className="text-sm text-ink-secondary">
        Link curto
      </p>

      <a
        href={link.shortUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block w-fit max-w-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        <span className="block truncate font-mono text-[15px] text-ink-secondary">
          {hostPrefix(link)}
        </span>
        <span className="block font-mono text-[clamp(3.5rem,16vw,6.5rem)] leading-[1.05] font-medium tracking-[-0.03em] break-all text-ink">
          {link.shortCode}
        </span>
      </a>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas transition-transform duration-100 ease-out hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.97]"
        >
          {copyStatus === 'copied' ? (
            <>
              <CheckIcon className="size-[18px]" />
              Copiado
            </>
          ) : (
            <>
              <CopyIcon className="size-[18px]" />
              Copiar link
            </>
          )}
        </button>
        <a
          href={link.shortUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline px-5 text-[15px] font-medium text-ink transition-transform duration-100 ease-out hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.97]"
        >
          Abrir
          <ArrowUpRightIcon className="size-4" />
        </a>
        <button
          type="button"
          onClick={onReset}
          className="h-11 rounded-full px-0 text-[15px] font-medium text-ink-secondary sm:ml-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Encurtar outro link
        </button>
      </div>

      {copyStatus === 'failed' && (
        <div className="mt-5 animate-fade-in">
          <label
            htmlFor="short-link-fallback"
            className="block text-sm text-ink"
          >
            O navegador bloqueou a cópia. O link está selecionado abaixo: use
            Ctrl+C (ou ⌘+C).
          </label>
          <input
            ref={fallbackInputRef}
            id="short-link-fallback"
            readOnly
            value={link.shortUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-11 w-full rounded-xl bg-fill px-4 font-mono text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
        </div>
      )}

      <dl className="mt-12 border-t border-hairline pt-5 text-sm">
        <dt className="text-ink-secondary">Original</dt>
        <dd className="mt-1 truncate text-ink" title={link.longUrl}>
          {link.longUrl}
        </dd>
        <dt className="sr-only">Tamanho</dt>
        <dd className="mt-3 font-mono text-xs text-ink-secondary">
          {link.longUrl.length} → {link.shortUrl.length} caracteres
        </dd>
      </dl>
    </section>
  )
}
