const ROOM_ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'
const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_CHARS}]{4}$`, 'i')

export function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => ROOM_ID_CHARS[b % ROOM_ID_CHARS.length]).join('')
}

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_PATTERN.test(id)
}

export function extractRoomId(scannedText: string): string | null {
  const text = scannedText.trim()
  try {
    const url = new URL(text)
    const hash = url.hash.slice(1)
    if (hash) return hash
  } catch {
    // Not a URL — treat as raw room ID
  }
  if (isValidRoomId(text)) return text
  return null
}
