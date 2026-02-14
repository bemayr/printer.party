import { joinRoom, selfId } from 'trystero/nostr'
import type { Room, ActionSender, JsonValue } from 'trystero'
import QRCodeStyling from 'qr-code-styling'

interface FileMetadata {
  name: string
  type: string
  size: number
}

const config = { appId: 'printer-party' }
const peers = new Set<string>()
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
const receiveSection = document.getElementById('receive-section') as HTMLElement
const receivedFiles = document.getElementById('received-files') as HTMLDivElement

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function printFile(url: string) {
  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print()
    })
  }
}

function displayReceivedFile(
  data: ArrayBuffer,
  metadata: FileMetadata,
  peerId: string
) {
  const blob = new Blob([data], { type: metadata.type })
  const url = URL.createObjectURL(blob)

  const container = document.createElement('div')
  container.className = 'received-file'

  const info = document.createElement('p')
  info.textContent = `${metadata.name} (${formatBytes(metadata.size)}) from ${peerId.slice(0, 8)}...`
  container.appendChild(info)

  if (metadata.type.startsWith('image/')) {
    const img = document.createElement('img')
    img.src = url
    img.style.maxWidth = '100%'
    img.style.maxHeight = '400px'
    container.appendChild(img)
  } else if (metadata.type === 'application/pdf') {
    const embed = document.createElement('embed')
    embed.src = url
    embed.type = 'application/pdf'
    embed.style.width = '100%'
    embed.style.height = '500px'
    container.appendChild(embed)
  }

  const printBtn = document.createElement('button')
  printBtn.textContent = 'Print'
  printBtn.addEventListener('click', () => printFile(url))
  container.appendChild(printBtn)

  const downloadBtn = document.createElement('button')
  downloadBtn.textContent = 'Download'
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a')
    a.href = url
    a.download = metadata.name
    a.click()
  })
  container.appendChild(downloadBtn)

  receivedFiles.prepend(container)
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

// Use room ID from URL hash, or generate a new one
const roomId = location.hash.slice(1) || generateRoomId()
location.hash = roomId
roomIdEl.textContent = roomId
roomStatus.textContent = `You: ${selfId.slice(0, 8)}...`

const roomUrl = `${location.origin}${location.pathname}#${roomId}`
const qrCode = new QRCodeStyling({
  width: 200,
  height: 200,
  data: roomUrl,
  dotsOptions: { type: 'rounded', color: '#1a1a1a' },
  backgroundOptions: { color: 'transparent' },
})
qrCode.append(roomQrEl)

const room: Room = joinRoom(config, roomId)

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

getFile((data, peerId, metadata) => {
  displayReceivedFile(data, metadata as unknown as FileMetadata, peerId)
})

peersSection.hidden = false
sendSection.hidden = false
receiveSection.hidden = false

// Event listeners
fileInput.addEventListener('change', () => {
  sendBtn.disabled = !fileInput.files?.length
})
sendBtn.addEventListener('click', sendFileHandler)
