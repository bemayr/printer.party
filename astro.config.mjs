// @ts-check
import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'

export default defineConfig({
  site: 'https://printer.party',
  integrations: [preact()],
  vite: {
    resolve: {
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
  },
})
