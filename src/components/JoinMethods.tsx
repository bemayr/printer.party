import { useState } from 'preact/hooks'
import { useSelector } from '@xstate/react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { actor } from '../scripts/actor'
import { isValidRoomId, extractRoomId } from '../scripts/utils'

export default function JoinMethods() {
  const isScanning = useSelector(actor, (s) => s.hasTag('scanning'))
  const isEnteringCode = useSelector(actor, (s) => s.hasTag('entering-code'))
  const [roomIdInput, setRoomIdInput] = useState('')

  function joinByInput() {
    const id = roomIdInput.trim().toLowerCase()
    if (isValidRoomId(id)) {
      actor.send({ type: 'JOIN_ROOM', roomId: id })
      setRoomIdInput('')
    }
  }

  return (
    <div class="join-methods">
      {!isScanning && !isEnteringCode ? (
        <div class="join-idle" style="display:flex;flex-direction:column;gap:0.5rem">
          <button onClick={() => actor.send({ type: 'START_SCAN' })}>Scan QR Code</button>
          <button class="muted-btn" onClick={() => actor.send({ type: 'START_CODE_ENTRY' })}>Enter code instead</button>
        </div>
      ) : isScanning ? (
        <div class="join-scan">
          <Scanner
            onScan={(codes) => {
              for (const code of codes) {
                const roomId = extractRoomId(code.rawValue)
                if (roomId) {
                  actor.send({ type: 'QR_DETECTED', roomId })
                  return
                }
              }
            }}
            onError={(error) => console.error('QR scanner error:', error)}
            constraints={{ facingMode: 'environment' }}
            scanDelay={200}
          />
          <button class="muted-btn" onClick={() => actor.send({ type: 'START_CODE_ENTRY' })}>
            Enter code instead
          </button>
          <button class="muted-btn" onClick={() => actor.send({ type: 'CANCEL_JOIN' })}>
            Cancel
          </button>
        </div>
      ) : (
        <div class="join-code">
          <div class="join-room-id">
            <input
              type="text"
              id="room-id-input"
              placeholder="code"
              maxLength={4}
              autocapitalize="none"
              autocomplete="off"
              value={roomIdInput}
              onInput={(e) => setRoomIdInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && joinByInput()}
            />
            <button onClick={joinByInput}>Join</button>
          </div>
          <button class="muted-btn" onClick={() => actor.send({ type: 'START_SCAN' })}>
            Scan QR instead
          </button>
          <button class="muted-btn" onClick={() => actor.send({ type: 'CANCEL_JOIN' })}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
