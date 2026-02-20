import { useRef } from 'preact/hooks'

interface Props {
  isSending: boolean
  sendProgress: number
  fileName: string
  onSendFile: (file: File) => void
  onCancelSend: () => void
}

export default function SendSection({ isSending, sendProgress, fileName, onSendFile, onCancelSend }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const progressText =
    sendProgress === 0
      ? `Sending ${fileName}...`
      : `${Math.round(sendProgress * 100)}%`

  return (
    <div class="send-section">
      <h2 class="step-label">2. Print</h2>
      {!isSending ? (
        <button onClick={() => fileInputRef.current?.click()}>Choose File & Print</button>
      ) : (
        <div id="send-progress">
          <div class="progress-row">
            <progress value={sendProgress} max={1} />
            <button class="cancel-btn" onClick={onCancelSend}>
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
          if (file) onSendFile(file)
          ;(e.target as HTMLInputElement).value = ''
        }}
      />
    </div>
  )
}
