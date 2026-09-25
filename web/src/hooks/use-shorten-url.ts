import { useMutation } from '@tanstack/react-query'

import { type ApiError, type ShortenedUrl, shortenUrl } from '../lib/api'

export const useShortenUrl = () =>
  useMutation<ShortenedUrl, ApiError, string>({
    mutationKey: ['shorten-url'],
    mutationFn: shortenUrl,
  })
