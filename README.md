# printer.party

Easy remote printing. Send files from your phone to a nearby printer — no apps, no drivers, no cloud.

**https://printer.party**

## How it works

1. Open **printer.party** on the computer connected to your printer. It generates a 4-character code and QR code.
2. On your phone, open **printer.party** and scan the QR code (or enter the code manually) to connect.
3. Pick a file (PDF or image) and tap **Print**. The file is sent directly to the other device, which opens the browser print dialog automatically.

Files are transferred peer-to-peer using WebRTC. Nothing is uploaded to a server.

## Tech stack

- [Astro](https://astro.build/) — static site generation
- [Trystero](https://github.com/dmotz/trystero) — peer-to-peer connections via Nostr relays
- [qr-code-styling](https://github.com/niccolobertini/qr-code-styling) — QR code generation
- [html5-qrcode](https://github.com/niccolobertini/html5-qrcode) — QR code scanning via camera
- TypeScript

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview  # preview the production build locally
```

## Deployment

The site is deployed to GitHub Pages via a GitHub Actions workflow on push to `main`.

## License

[ISC](LICENSE)
