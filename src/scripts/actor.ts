import { createActor, fromCallback } from 'xstate'
import { createBrowserInspector } from '@statelyai/inspect'
import { joinRoom } from 'trystero/nostr'
import type { ActionSender, JsonValue } from 'trystero'
import { printerPartyMachine } from './machine'
import type { FileMetadata, AppEvent, RoomActorInput, FileTransferActorInput } from './machine'
import { generateRoomId, isValidRoomId } from './utils'

// Inspector starts silent; Ctrl+Shift+X opens the window.
const inspector = createBrowserInspector({ autoStart: false })

// ── Module-level resources (managed by actors, not machine context) ───────────

let sendFileFn: ActionSender<ArrayBuffer> | null = null

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

// ── Actor implementations ─────────────────────────────────────────────────────

const roomActorImpl = fromCallback<AppEvent, RoomActorInput>(({ input, sendBack }) => {
  const room = joinRoom({ appId: 'printer-party' }, input.roomId)

  room.onPeerJoin((peerId) => sendBack({ type: 'PEER_JOINED', peerId }))
  room.onPeerLeave((peerId) => sendBack({ type: 'PEER_LEFT', peerId }))

  const [fn, getFile] = room.makeAction<ArrayBuffer>('file')
  sendFileFn = fn

  getFile((data, _peerId, metadata) => {
    printReceivedFile(data, metadata as unknown as FileMetadata)
  })

  return () => {
    room.leave()
    sendFileFn = null
  }
})

const fileTransferActorImpl = fromCallback<AppEvent, FileTransferActorInput>(
  ({ input, sendBack }) => {
    const abort = new AbortController()
    const fn = sendFileFn

    if (!fn) {
      sendBack({ type: 'SEND_DONE' })
      return () => {}
    }

    input.file
      .arrayBuffer()
      .then((buffer) => {
        const metadata: FileMetadata = {
          name: input.file.name,
          type: input.file.type,
          size: input.file.size,
        }
        return fn(buffer, null, metadata as unknown as JsonValue, (percent) => {
          if (!abort.signal.aborted) sendBack({ type: 'SEND_PROGRESS', percent })
        })
      })
      .then(() => {
        if (!abort.signal.aborted) sendBack({ type: 'SEND_DONE' })
      })
      .catch(() => {
        if (!abort.signal.aborted) sendBack({ type: 'SEND_DONE' })
      })

    return () => abort.abort()
  }
)

// ── Actor singleton ───────────────────────────────────────────────────────────

const hashRoomId = location.hash.slice(1)
const initialRoomId = hashRoomId && isValidRoomId(hashRoomId) ? hashRoomId : generateRoomId()
if (hashRoomId) history.replaceState(null, '', location.pathname + location.search)

export const actor = createActor(
  printerPartyMachine.provide({
    actors: {
      printerRoomActor: roomActorImpl,
      printingRoomActor: roomActorImpl,
      fileTransferActor: fileTransferActorImpl,
    },
  }),
  {
    input: { initialRoomId },
    inspect: inspector.inspect,
  }
)

actor.start()

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'X') inspector.start()
})

const mq = window.matchMedia('(max-width: 640px)')
mq.addEventListener('change', (e) => {
  if (e.matches) actor.send({ type: 'SWITCH_TAB', tab: 'print' })
})
