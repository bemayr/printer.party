// @ts-check
import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'

export default defineConfig({
  site: 'https://printer.party',
  integrations: [preact()],
})
