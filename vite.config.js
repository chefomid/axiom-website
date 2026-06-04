import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['maplibre-gl'],
    esbuildOptions: { target: 'es2022' },
  },
  build: {
    target: 'es2022',
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api/nws': {
        target: 'https://api.weather.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/nws/, ''),
        headers: {
          'User-Agent': 'AXIOM-PublicDataCommand/1.0 (public-data-command)',
        },
      },
      '/api/fema': {
        target: 'https://hazards.fema.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/fema/, ''),
      },
      '/api/firms': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/firms/, ''),
      },
      '/api/property': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/property/, ''),
      },
      '/api/reports': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/reports/, '/reports'),
      },
      '/api/census': {
        target: 'https://geocoding.geo.census.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/census/, ''),
      },
      '/api/photon': {
        target: 'https://photon.komoot.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/photon/, ''),
      },
    },
  },
})
