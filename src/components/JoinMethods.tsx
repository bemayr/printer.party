import { useState } from 'preact/hooks'
import { Scanner } from '@yudiel/react-qr-scanner'
import { isValidRoomId, extractRoomId } from '../scripts/utils'

interface Props {
  onJoinRoom: (roomId: string) => void
}

export default function JoinMethods({ onJoinRoom }: Props) {
  const [joinMethod, setJoinMethod] = useState<'idle' | 'scan' | 'code'>('idle')
  const [roomIdInput, setRoomIdInput] = useState('')

  function joinByInput() {
    const id = roomIdInput.trim().toLowerCase()
    if (isValidRoomId(id)) {
      onJoinRoom(id)
      setRoomIdInput('')
    }
  }

  return (
    <div class="join-methods">
      {joinMethod === 'idle' ? (
        <div class="join-idle" style="display:flex;flex-direction:column;gap:0.5rem">
          <button onClick={() => setJoinMethod('scan')}>Scan QR Code</button>
          <button class="muted-btn" onClick={() => setJoinMethod('code')}>Enter code instead</button>
        </div>
      ) : joinMethod === 'scan' ? (
        <div class="join-scan">
          <Scanner
            onScan={(codes) => {
              for (const code of codes) {
                const roomId = extractRoomId(code.rawValue)
                if (roomId) {
                  onJoinRoom(roomId)
                  return
                }
              }
            }}
            onError={(error) => console.error('QR scanner error:', error)}
            constraints={{ facingMode: 'environment' }}
            scanDelay={200}
          />
          <button class="muted-btn" onClick={() => setJoinMethod('code')}>
            Enter code instead
          </button>
          <button class="muted-btn" onClick={() => setJoinMethod('idle')}>
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
          <button class="muted-btn" onClick={() => setJoinMethod('scan')}>
            Scan QR instead
          </button>
          <button class="muted-btn" onClick={() => setJoinMethod('idle')}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
