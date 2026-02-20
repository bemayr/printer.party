import { useEffect, useRef } from 'preact/hooks'
import QRCodeStyling from 'qr-code-styling'

interface Props {
  data: string
}

export default function QRCodeDisplay({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const qrCodeRef = useRef<QRCodeStyling | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (!qrCodeRef.current) {
      qrCodeRef.current = new QRCodeStyling({
        width: 200,
        height: 200,
        data,
        dotsOptions: { type: 'rounded', color: '#292524' },
        backgroundOptions: { color: 'transparent' },
      })
      qrCodeRef.current.append(containerRef.current)
    } else {
      qrCodeRef.current.update({ data })
    }
  }, [data])

  // Intentionally no JSX children — QRCodeStyling owns the interior of this div.
  return <div ref={containerRef} id="room-qr" />
}
