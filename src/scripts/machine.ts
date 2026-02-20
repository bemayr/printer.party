import { setup, assign, fromCallback } from 'xstate'

export interface FileMetadata {
  name: string
  type: string
  size: number
}

export interface AppContext {
  roomId: string
  peers: Set<string>
  fileToSend: File | null
  sendProgress: number
  scanError: string | null
  activeTab: 'room' | 'print'
}

export type AppEvent =
  // From roomActor
  | { type: 'PEER_JOINED'; peerId: string }
  | { type: 'PEER_LEFT'; peerId: string }
  // From scannerActor
  | { type: 'QR_DETECTED'; roomId: string }
  | { type: 'SCANNER_READY' }
  | { type: 'SCANNER_ERROR'; message: string }
  // From fileTransferActor
  | { type: 'SEND_PROGRESS'; percent: number }
  | { type: 'SEND_DONE' }
  // User interactions
  | { type: 'JOIN_ROOM'; roomId: string }
  | { type: 'DISCONNECT' }
  | { type: 'SCAN_TOGGLE' }
  | { type: 'SEND_FILE'; file: File }
  | { type: 'SEND_CANCEL' }
  | { type: 'SWITCH_TAB'; tab: 'room' | 'print' }

// Actor input types — used by printer-party.ts when providing implementations
export interface RoomActorInput { roomId: string }
export interface FileTransferActorInput { file: File }

export const printerPartyMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
    input: {} as { initialRoomId: string },
  },
  actors: {
    // Placeholder implementations — overridden via machine.provide() in printer-party.ts
    roomActor: fromCallback<AppEvent, RoomActorInput>(() => () => {}),
    scannerActor: fromCallback<AppEvent>(() => () => {}),
    fileTransferActor: fromCallback<AppEvent, FileTransferActorInput>(() => () => {}),
  },
  actions: {
    addPeer: assign({
      peers: ({ context, event }) => {
        if (event.type !== 'PEER_JOINED') return context.peers
        const next = new Set(context.peers)
        next.add(event.peerId)
        return next
      },
    }),
    removePeer: assign({
      peers: ({ context, event }) => {
        if (event.type !== 'PEER_LEFT') return context.peers
        const next = new Set(context.peers)
        next.delete(event.peerId)
        return next
      },
    }),
    clearPeers: assign({ peers: () => new Set<string>() }),
    setRoomId: assign({
      roomId: ({ event }) => {
        if (event.type !== 'JOIN_ROOM' && event.type !== 'QR_DETECTED') return ''
        return event.roomId
      },
    }),
    setFileToSend: assign({
      fileToSend: ({ event }) => (event.type === 'SEND_FILE' ? event.file : null),
    }),
    clearFileToSend: assign({ fileToSend: null }),
    updateProgress: assign({
      sendProgress: ({ event }) => (event.type === 'SEND_PROGRESS' ? event.percent : 0),
    }),
    resetProgress: assign({ sendProgress: 0 }),
    setScanError: assign({
      scanError: ({ event }) => (event.type === 'SCANNER_ERROR' ? event.message : null),
    }),
    clearScanError: assign({ scanError: null }),
    switchTab: assign({
      activeTab: ({ event }) => (event.type === 'SWITCH_TAB' ? event.tab : 'print'),
    }),
  },
  guards: {
    hasPeers: ({ context }) => context.peers.size > 0,
    noPeers: ({ context }) => context.peers.size === 0,
  },
}).createMachine({
  id: 'printerParty',
  context: ({ input }) => ({
    roomId: input.initialRoomId,
    peers: new Set<string>(),
    fileToSend: null,
    sendProgress: 0,
    scanError: null,
    activeTab: 'print' as const,
  }),
  on: {
    SWITCH_TAB: { actions: 'switchTab' },
    PEER_JOINED: { actions: 'addPeer' },
    PEER_LEFT: { actions: 'removePeer' },
    DISCONNECT: {
      target: '.reinitializing',
      actions: 'clearPeers',
    },
    JOIN_ROOM: {
      target: '.reinitializing',
      actions: ['setRoomId', 'clearPeers'],
    },
    QR_DETECTED: {
      target: '.reinitializing',
      actions: [
        assign({ roomId: ({ event }) => (event.type === 'QR_DETECTED' ? event.roomId : '') }),
        'clearPeers',
      ],
    },
  },
  initial: 'active',
  states: {
    // Transitional: updates roomId in context, then immediately re-enters active.
    // Re-entering active stops and restarts the roomActor with the new roomId.
    reinitializing: {
      always: 'active',
    },

    active: {
      invoke: {
        id: 'room',
        src: 'roomActor',
        input: ({ context }): RoomActorInput => ({ roomId: context.roomId }),
      },
      initial: 'waiting',
      states: {
        waiting: {
          always: [{ guard: 'hasPeers', target: 'connected' }],
          initial: 'idle',
          states: {
            idle: {
              entry: 'clearScanError',
              on: {
                SCAN_TOGGLE: 'scanning',
              },
            },
            scanning: {
              invoke: {
                id: 'scanner',
                src: 'scannerActor',
              },
              on: {
                SCAN_TOGGLE: 'idle',
                SCANNER_READY: { actions: 'clearScanError' },
                SCANNER_ERROR: {
                  target: 'idle',
                  actions: 'setScanError',
                },
              },
            },
          },
        },

        connected: {
          always: [{ guard: 'noPeers', target: 'waiting' }],
          initial: 'idle',
          states: {
            idle: {
              entry: 'resetProgress',
              on: {
                SEND_FILE: {
                  target: 'sending',
                  actions: 'setFileToSend',
                },
              },
            },
            sending: {
              invoke: {
                id: 'fileTransfer',
                src: 'fileTransferActor',
                input: ({ context }): FileTransferActorInput => ({ file: context.fileToSend! }),
              },
              on: {
                SEND_PROGRESS: { actions: 'updateProgress' },
                SEND_DONE: {
                  target: 'idle',
                  actions: 'clearFileToSend',
                },
                SEND_CANCEL: {
                  target: 'idle',
                  actions: 'clearFileToSend',
                },
              },
            },
          },
        },
      },
    },
  },
})

