import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // DEV ONLY: /api lives in Cloudflare Pages Functions, which vite doesn't run.
    // Proxying to prod lets API-backed pages render locally with real data and
    // keeps fetches same-origin (the site's CSP allows only connect-src 'self').
    proxy: {
      '/api': { target: 'https://guileoai.com', changeOrigin: true },
    },
  },
  build: {
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split heavy vendors into cached chunks so the landing's critical path is lean
        // and repeat visits hit the cache. three.js + Supabase only load on the routes
        // that need them (3D hero / portal), never blocking first paint.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // @sentry must stay OUT of any eager chunk — monitoring.js lazy-imports it on purpose;
          // matching it into 'react' below fused ~150KB gzip of Sentry into the critical path.
          if (id.includes('@sentry')) return
          if (id.includes('three') || id.includes('@react-three') || id.includes('postprocessing')) return 'three'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('react-router')) return 'router'
          // exact-path match: a bare includes('react') also swallowed @sentry/react + react-icons
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})
