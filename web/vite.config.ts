import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const { VITE_API_URL } = loadEnv(mode, process.cwd(), 'VITE_')

  if (command === 'build' && !URL.canParse(VITE_API_URL ?? '')) {
    throw new Error(
      `VITE_API_URL must be an absolute URL to build the frontend, received "${VITE_API_URL ?? ''}"`,
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      strictPort: true,
    },
    preview: {
      port: 3000,
      strictPort: true,
    },
  }
})
