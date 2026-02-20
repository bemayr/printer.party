import { useSelector } from '@xstate/react'
import { actor } from '../scripts/actor'
import QRCodeDisplay from './QRCodeDisplay'
import './PrinterPanel.css'

export default function PrinterPanel() {
  const roomId = useSelector(actor, (s) => s.context.roomId)
  const isConnected = useSelector(actor, (s) => s.matches({ active: 'connected' }))
  const peerCount = useSelector(actor, (s) => s.context.peers.size)
  const activeTab = useSelector(actor, (s) => s.context.activeTab)

  const roomUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#${roomId}`
      : ''

  const peerText = isConnected
    ? peerCount === 1
      ? '1 peer connected'
      : `${peerCount} peers connected`
    : 'Waiting for connection...'

  return (
    <div id="tab-room" class={`tab-panel${activeTab === 'room' ? ' active' : ''}`}>
      <section id="room-section">
        <h2 class="panel-title">Share Printer</h2>
        <p class="room-hint">Scan the QR code or enter the code on another device to connect.</p>
        {roomUrl && <QRCodeDisplay data={roomUrl} />}
        <p class="room-id-display">{roomId}</p>
        <span class={`peer-status${isConnected ? ' connected' : ''}`}>
          <span class="peer-count">{peerText}</span>
        </span>
      </section>
    </div>
  )
}
