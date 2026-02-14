# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Astro dev server with hot reload
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally

No test runner or linter is configured.

## Architecture

**printer.party** is a peer-to-peer file sharing app that lets you send files (PDFs, images) to connected peers and auto-trigger browser print dialogs on receipt.

**Stack:** Astro 5 (static SSG) + TypeScript (strict) + Trystero (P2P via Nostr relays) + QR code libraries

### Key Files

- `src/pages/index.astro` — Single-page app: HTML structure, CSS (responsive with 640px breakpoint), and script import. Desktop shows dual-panel layout; mobile uses tab navigation (Room/Print).
- `src/scripts/printer-party.ts` — All application logic: room management, P2P connections, file transfer, QR code generation/scanning, and auto-print via hidden iframe.

### How It Works

1. On load, an 8-char alphanumeric room ID is generated and stored in `location.hash`
2. A QR code is rendered linking to the app URL with that hash
3. Peers join the same room via QR scan (mobile camera) or URL sharing
4. Trystero (Nostr relay strategy, appId: `'printer-party'`) handles WebRTC signaling and data channels
5. Files are sent as `ArrayBuffer` with metadata (`name`, `type`, `size`) via `room.makeAction<ArrayBuffer>('file')`
6. On receipt, files auto-print using a hidden iframe: PDFs use native viewer, images are wrapped in HTML with print-friendly CSS

### P2P Data Flow

```
Printer (creates room) <──Trystero/Nostr──> Sender (joins via QR/URL)
   └─ receives file                              └─ sends file + metadata
   └─ auto-prints via hidden iframe
```

### Accepted File Types

PDF (`.pdf`) and images (`image/*`), validated at the file input level.
