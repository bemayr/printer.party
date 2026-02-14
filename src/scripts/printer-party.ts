import { joinRoom } from 'trystero/nostr'
import type { Room, ActionSender, JsonValue } from 'trystero'
import QRCodeStyling from 'qr-code-styling'
import { Html5Qrcode } from 'html5-qrcode'

interface FileMetadata {
  name: string
  type: string
  size: number
}

const config = { appId: 'printer-party' }
const peers = new Set<string>()
let room: Room | null = null
let sendFile: ActionSender<ArrayBuffer> | null = null

// DOM references
const roomQrEl = document.getElementById('room-qr') as HTMLDivElement
const roomIdEl = document.getElementById('room-id') as HTMLElement
const peerDot = document.getElementById('peer-dot') as HTMLElement
const peerCount = document.getElementById('peer-count') as HTMLElement
const sendSection = document.getElementById('send-section') as HTMLElement
const fileInput = document.getElementById('file-input') as HTMLInputElement
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement
const sendProgress = document.getElementById('send-progress') as HTMLDivElement
const sendProgressBar = document.getElementById(
  'send-progress-bar'
) as HTMLProgressElement
const sendProgressText = document.getElementById(
  'send-progress-text'
) as HTMLSpanElement
const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement
const scannerEl = document.getElementById('scanner') as HTMLDivElement
const scanStatus = document.getElementById('scan-status') as HTMLParagraphElement
const roomIdInput = document.getElementById('room-id-input') as HTMLInputElement
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement

let qrCode: QRCodeStyling | null = null
let scanner: Html5Qrcode | null = null

function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function updatePeerDot() {
  peerDot.hidden = peers.size === 0
  peerCount.textContent = peers.size === 1 ? '1 peer' : `${peers.size} peers`
}

function printReceivedFile(data: ArrayBuffer, metadata: FileMetadata) {
  const blob = new Blob([data], { type: metadata.type })
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  document.body.appendChild(iframe)

  if (metadata.type.startsWith('image/')) {
    const html = `<!DOCTYPE html>
<html><head><style>
  @page { margin: 0; }
  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  img { max-width: 100%; max-height: 100vh; object-fit: contain; }
</style></head><body><img src="${url}"></body></html>`
    iframe.srcdoc = html
  } else {
    iframe.src = url
  }

  iframe.addEventListener('load', () => {
    iframe.contentWindow?.print()
    iframe.addEventListener('afterprint', () => {
      iframe.remove()
      URL.revokeObjectURL(url)
    })
  })
}

let sendAbort: AbortController | null = null

async function sendFileHandler() {
  const file = fileInput.files?.[0]
  if (!file || !sendFile) return

  const buffer = await file.arrayBuffer()
  const metadata: FileMetadata = {
    name: file.name,
    type: file.type,
    size: file.size,
  }

  sendBtn.hidden = true
  sendProgress.hidden = false
  sendProgressBar.value = 0
  sendProgressText.textContent = `Sending ${file.name}...`

  sendAbort = new AbortController()
  const aborted = sendAbort.signal

  await sendFile(
    buffer,
    null,
    metadata as unknown as JsonValue,
    (percent, _peerId) => {
      if (aborted.aborted) return
      sendProgressBar.value = percent
      sendProgressText.textContent = `${Math.round(percent * 100)}%`
    }
  )

  if (!aborted.aborted) {
    sendProgressBar.value = 1
    sendProgressText.textContent = 'Sent!'
    setTimeout(() => {
      sendProgress.hidden = true
      sendBtn.hidden = false
    }, 1500)
  }

  sendAbort = null
  fileInput.value = ''
}

function connectToRoom(roomId: string) {
  roomId = roomId.toLowerCase()

  // Leave existing room
  if (room) {
    room.leave()
    room = null
    sendFile = null
    peers.clear()
    updatePeerDot()
  }

  // Update display
  roomIdEl.textContent = roomId

  // Update QR code — encode just the room ID
  const roomUrl = roomId
  if (qrCode) {
    qrCode.update({ data: roomUrl })
  } else {
    qrCode = new QRCodeStyling({
      width: 200,
      height: 200,
      data: roomUrl,
      dotsOptions: { type: 'rounded', color: '#7c5cbf' },
      backgroundOptions: { color: 'transparent' },
    })
    qrCode.append(roomQrEl)
  }

  // Join room
  room = joinRoom(config, roomId)

  room.onPeerJoin((peerId) => {
    peers.add(peerId)
    updatePeerDot()
  })

  room.onPeerLeave((peerId) => {
    peers.delete(peerId)
    updatePeerDot()
  })

  const [sendFileFn, getFile] = room.makeAction<ArrayBuffer>('file')
  sendFile = sendFileFn

  getFile((data, _peerId, metadata) => {
    printReceivedFile(data, metadata as unknown as FileMetadata)
  })

  sendSection.hidden = false
}

function extractRoomId(scannedText: string): string | null {
  const text = scannedText.trim()
  // Try to parse as URL and extract hash (backwards compat with old QR codes)
  try {
    const url = new URL(text)
    const hash = url.hash.slice(1)
    if (hash) return hash
  } catch {
    // Not a URL — treat as raw room ID
  }
  if (/^[abcdefghjkmnpqrstuvwxyz23456789]{4}$/i.test(text)) return text
  return null
}

async function startScanner() {
  if (scanner) {
    await scanner.stop()
    scanner = null
    scannerEl.hidden = true
    scanBtn.textContent = 'Scan QR Code'
    scanStatus.textContent = ''
    return
  }

  scannerEl.hidden = false
  scanBtn.textContent = 'Stop Scanner'
  scanStatus.textContent = 'Starting camera...'

  scanner = new Html5Qrcode('scanner')
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        const roomId = extractRoomId(decodedText)
        if (!roomId) {
          scanStatus.textContent = 'Invalid QR code, try again...'
          return
        }

        // Stop scanner and join room
        await scanner!.stop()
        scanner = null
        scannerEl.hidden = true
        scanBtn.textContent = 'Scan QR Code'
        scanStatus.textContent = `Connected: ${roomId}`

        connectToRoom(roomId)
      },
      () => {} // ignore scan failures (no QR in frame)
    )
    scanStatus.textContent = 'Point camera at QR code...'
  } catch (err) {
    scanStatus.textContent = `Camera error: ${err}`
    scannerEl.hidden = true
    scanBtn.textContent = 'Scan QR Code'
    scanner = null
  }
}

// Initial room connection
connectToRoom(generateRoomId())

// Event listeners
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement

sendBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) sendFileHandler()
})
cancelBtn.addEventListener('click', () => {
  sendAbort?.abort()
  sendAbort = null
  sendProgress.hidden = true
  sendBtn.hidden = false
  fileInput.value = ''
})
scanBtn.addEventListener('click', startScanner)

// Join by room ID input
function joinByInput() {
  const id = roomIdInput.value.trim().toLowerCase()
  if (/^[abcdefghjkmnpqrstuvwxyz23456789]{4}$/i.test(id)) {
    connectToRoom(id)
    scanStatus.textContent = `Connected: ${id}`
  } else {
    scanStatus.textContent = 'Enter a valid 4-character code'
  }
}
joinBtn.addEventListener('click', joinByInput)
roomIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinByInput()
})

// Tab switching (mobile only)
function switchTab(name: string) {
  document
    .querySelectorAll('.tab, .tab-panel')
    .forEach((el) => el.classList.remove('active'))
  document
    .querySelector(`.tab[data-tab="${name}"]`)
    ?.classList.add('active')
  document.getElementById(`tab-${name}`)?.classList.add('active')
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab!))
})

// On mobile, default to the Print tab
if (window.matchMedia('(max-width: 640px)').matches) {
  switchTab('print')
}

// Info overlay
const infoOverlay = document.getElementById('info-overlay') as HTMLDivElement
const infoBtn = document.getElementById('info-btn')!
infoBtn.addEventListener('click', () => {
  const opening = infoOverlay.hidden
  infoOverlay.hidden = !opening
  infoBtn.textContent = opening ? '\u00d7' : '?'
  infoBtn.setAttribute('aria-label', opening ? 'Close info' : 'How it works')
})
