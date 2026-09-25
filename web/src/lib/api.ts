const API_URL = (
  import.meta.env.VITE_API_URL ?? 'https://url-shortener-lchk.onrender.com'
).replace(/\/+$/, '')

export type ShortenedUrl = {
  shortCode: string
  shortUrl: string
  longUrl: string
}

type ApiErrorBody = {
  error: string
  code: string
}

export class ApiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

const friendlyMessageByCode: Record<string, string> = {
  VALIDATION_ERROR:
    'URL inválida. Informe um endereço completo, como https://exemplo.com/pagina.',
  ALREADY_SHORTENED:
    'Esse link já é uma URL encurtada por este serviço. Cole o endereço original.',
  RATE_LIMITED:
    'Você encurtou muitas URLs em pouco tempo. Aguarde um minuto e tente novamente.',
  INTERNAL_SERVER_ERROR:
    'O servidor encontrou um erro ao encurtar sua URL. Tente novamente em instantes.',
}

const isApiErrorBody = (body: unknown): body is ApiErrorBody =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  'code' in body

export const shortenUrl = async (url: string): Promise<ShortenedUrl> => {
  let response: Response

  try {
    response = await fetch(`${API_URL}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      'NETWORK_ERROR',
    )
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const code = isApiErrorBody(body) ? body.code : 'UNKNOWN_ERROR'
    throw new ApiError(
      friendlyMessageByCode[code] ??
        (isApiErrorBody(body) ? body.error : 'Algo deu errado. Tente novamente.'),
      code,
    )
  }

  return body as ShortenedUrl
}
