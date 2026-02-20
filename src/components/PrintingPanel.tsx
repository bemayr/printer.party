import { useState, useRef } from 'preact/hooks'
import { useSelector } from '@xstate/react'
import { actor } from '../scripts/actor'
import { isValidRoomId } from '../scripts/utils'

export default function PrintingPanel() {
  const isConnected = useSelector(actor, (s) => s.matches({ active: 'connected' }))
  const isScanning = useSelector(actor, (s) => s.matches({ active: { waiting: 'scanning' } }))
  const isSending = useSelector(actor, (s) => s.matches({ active: { connected: 'sending' } }))
  const sendProgress = useSelector(actor, (s) => s.context.sendProgress)
  const fileName = useSelector(actor, (s) => s.context.fileToSend?.name ?? '')
  const scanError = useSelector(actor, (s) => s.context.scanError)
  const activeTab = useSelector(actor, (s) => s.context.activeTab)
  const peerCount = useSelector(actor, (s) => s.context.peers.size)

  const [joinMethod, setJoinMethod] = useState<'scan' | 'code'>('scan')
  const [roomIdInput, setRoomIdInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const peerText = peerCount === 1 ? '1 printer connected' : `${peerCount} printers connected`

  const progressText =
    sendProgress === 0
      ? `Sending ${fileName}...`
      : `${Math.round(sendProgress * 100)}%`

  function joinByInput() {
    const id = roomIdInput.trim().toLowerCase()
    if (isValidRoomId(id)) {
      actor.send({ type: 'JOIN_ROOM', roomId: id })
      setRoomIdInput('')
    }
  }

  return (
    <div id="tab-print" class={`tab-panel${activeTab === 'print' ? ' active' : ''}`}>
      <section id="scan-section">
        <h2 class="panel-title">Print File</h2>
        <h2 class="step-label">1. Connect</h2>

        {!isConnected && (
          <div class="join-methods">
            {joinMethod === 'scan' ? (
              <div class="join-scan">
                <button onClick={() => actor.send({ type: 'SCAN_TOGGLE' })}>
                  {isScanning ? 'Stop Scanner' : 'Scan QR Code'}
                </button>
                <button class="muted-btn" onClick={() => setJoinMethod('code')}>
                  Enter code instead
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
              </div>
            )}
          </div>
        )}

        {isConnected && (
          <div class="connect-status">
            <span class="connect-status-dot">{peerText}</span>
            <button class="muted-btn" onClick={() => actor.send({ type: 'DISCONNECT' })}>
              Connect to different printer
            </button>
          </div>
        )}

        {/* Always rendered — Html5Qrcode needs this element to exist in the DOM
            before scannerActor starts (which happens synchronously on state transition). */}
        <div id="scanner" hidden={!isScanning} />

        {scanError && <p id="scan-status">Camera error: {scanError}</p>}
        {!scanError && isScanning && <p id="scan-status">Point camera at QR code...</p>}

        {isConnected && (
          <div class="send-section">
            <h2 class="step-label">2. Print</h2>
            {!isSending ? (
              <button onClick={() => fileInputRef.current?.click()}>Choose File & Print</button>
            ) : (
              <div id="send-progress">
                <div class="progress-row">
                  <progress value={sendProgress} max={1} />
                  <button class="cancel-btn" onClick={() => actor.send({ type: 'SEND_CANCEL' })}>
                    Cancel
                  </button>
                </div>
                <span id="send-progress-text">{progressText}</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              hidden
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) actor.send({ type: 'SEND_FILE', file })
                ;(e.target as HTMLInputElement).value = ''
              }}
            />
          </div>
        )}
      </section>
    </div>
  )
}
