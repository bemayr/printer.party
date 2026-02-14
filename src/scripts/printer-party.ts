import { joinRoom, selfId } from 'trystero/nostr'
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
const roomStatus = document.getElementById('room-status') as HTMLParagraphElement
const peersSection = document.getElementById('peers-section') as HTMLElement
const peersList = document.getElementById('peers-list') as HTMLUListElement
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

let qrCode: QRCodeStyling | null = null
let scanner: Html5Qrcode | null = null

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function updatePeersList() {
  peersList.innerHTML = ''
  for (const peerId of peers) {
    const li = document.createElement('li')
    li.textContent = peerId.slice(0, 12) + '...'
    peersList.appendChild(li)
  }
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

async function sendFileHandler() {
  const file = fileInput.files?.[0]
  if (!file || !sendFile) return

  const buffer = await file.arrayBuffer()
  const metadata: FileMetadata = {
    name: file.name,
    type: file.type,
    size: file.size,
  }

  sendBtn.disabled = true
  sendProgress.hidden = false
  sendProgressBar.value = 0
  sendProgressText.textContent = '0%'

  await sendFile(
    buffer,
    null,
    metadata as unknown as JsonValue,
    (percent, _peerId) => {
      sendProgressBar.value = percent
      sendProgressText.textContent = `${Math.round(percent * 100)}%`
    }
  )

  sendProgressBar.value = 1
  sendProgressText.textContent = 'Sent!'
  sendBtn.disabled = false
}

function connectToRoom(roomId: string) {
  // Leave existing room
  if (room) {
    room.leave()
    room = null
    sendFile = null
    peers.clear()
    peersList.innerHTML = ''
  }

  // Update URL and display
  location.hash = roomId
  roomIdEl.textContent = roomId
  roomStatus.textContent = `You: ${selfId.slice(0, 8)}...`

  // Update QR code
  const roomUrl = `${location.origin}${location.pathname}#${roomId}`
  if (qrCode) {
    qrCode.update({ data: roomUrl })
  } else {
    qrCode = new QRCodeStyling({
      width: 200,
      height: 200,
      data: roomUrl,
      dotsOptions: { type: 'rounded', color: '#1a1a1a' },
      backgroundOptions: { color: 'transparent' },
    })
    qrCode.append(roomQrEl)
  }

  // Join room
  room = joinRoom(config, roomId)

  room.onPeerJoin((peerId) => {
    peers.add(peerId)
    updatePeersList()
  })

  room.onPeerLeave((peerId) => {
    peers.delete(peerId)
    updatePeersList()
  })

  const [sendFileFn, getFile] = room.makeAction<ArrayBuffer>('file')
  sendFile = sendFileFn

  getFile((data, _peerId, metadata) => {
    printReceivedFile(data, metadata as unknown as FileMetadata)
  })

  peersSection.hidden = false
  sendSection.hidden = false
}

function extractRoomId(scannedText: string): string | null {
  // Try to parse as URL and extract hash
  try {
    const url = new URL(scannedText)
    const hash = url.hash.slice(1)
    if (hash) return hash
  } catch {
    // Not a URL — treat as raw room ID if it matches the format
  }
  // Accept raw 8-char alphanumeric room IDs
  if (/^[a-z0-9]{8}$/.test(scannedText)) return scannedText
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
        scanStatus.textContent = `Joined room: ${roomId}`

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
const initialRoomId = location.hash.slice(1) || generateRoomId()
connectToRoom(initialRoomId)

// Event listeners
fileInput.addEventListener('change', () => {
  sendBtn.disabled = !fileInput.files?.length
})
sendBtn.addEventListener('click', sendFileHandler)
scanBtn.addEventListener('click', startScanner)

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
