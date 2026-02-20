import { useSelector } from '@xstate/react'
import { actor } from '../scripts/actor'
import JoinMethods from './JoinMethods'
import SendSection from './SendSection'
import './PrintFilePanel.css'

export default function PrintFilePanel() {
  const isConnected = useSelector(actor, (s) => s.hasTag('peer-connected'))
  const isSending = useSelector(actor, (s) => s.hasTag('sending'))
  const sendProgress = useSelector(actor, (s) => s.context.sendProgress)
  const fileName = useSelector(actor, (s) => s.context.fileToSend?.name ?? '')
  const activeTab = useSelector(actor, (s) => s.context.activeTab)
  const peerCount = useSelector(actor, (s) => s.context.peers.size)

  const peerText = peerCount === 1 ? '1 printer connected' : `${peerCount} printers connected`

  return (
    <div id="tab-print" class={`tab-panel${activeTab === 'print' ? ' active' : ''}`}>
      <section id="scan-section">
        <h2 class="panel-title">Print File</h2>
        <h2 class="step-label">1. Connect</h2>

        {!isConnected && <JoinMethods />}

        {isConnected && (
          <div class="connect-status">
            <span class="connect-status-dot">{peerText}</span>
            <button class="muted-btn" onClick={() => actor.send({ type: 'DISCONNECT' })}>
              Connect to different printer
            </button>
          </div>
        )}

        <SendSection
          isConnected={isConnected}
          isSending={isSending}
          sendProgress={sendProgress}
          fileName={fileName}
          onSendFile={(file) => actor.send({ type: 'SEND_FILE', file })}
          onCancelSend={() => actor.send({ type: 'SEND_CANCEL' })}
        />
      </section>
    </div>
  )
}
