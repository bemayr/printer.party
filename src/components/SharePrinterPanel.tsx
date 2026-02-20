import { useSelector } from '@xstate/react'
import { actor } from '../scripts/actor'
import QRCode from 'react-qr-code'
import './SharePrinterPanel.css'

export default function SharePrinterPanel() {
  const roomId = useSelector(actor, (s) => s.context.printerRoomId)
  const isConnected = useSelector(actor, (s) => s.hasTag('printer-connected'))
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
        {roomUrl && <QRCode id="room-qr" value={roomUrl} size={200} fgColor="#292524" bgColor="transparent" />}
        <p class="room-id-display">{roomId}</p>
        <span class={`peer-status${isConnected ? ' connected' : ''}`}>
          <span class="peer-count">{peerText}</span>
        </span>
      </section>
    </div>
  )
}
