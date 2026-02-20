import { setup, assign, fromCallback } from 'xstate'

export interface FileMetadata {
  name: string
  type: string
  size: number
}

export interface AppContext {
  printerRoomId: string   // the room this device owns
  printingRoomId: string  // the room this device is sending to
  peers: Set<string>
  fileToSend: File | null
  sendProgress: number
  activeTab: 'room' | 'print'
}

export type AppEvent =
  // From printerRoomActor / printingRoomActor
  | { type: 'PEER_JOINED'; peerId: string }
  | { type: 'PEER_LEFT'; peerId: string }
  // From QR scanner component
  | { type: 'QR_DETECTED'; roomId: string }
  // From fileTransferActor
  | { type: 'SEND_PROGRESS'; percent: number }
  | { type: 'SEND_DONE' }
  // User interactions
  | { type: 'JOIN_ROOM'; roomId: string }
  | { type: 'DISCONNECT' }
  | { type: 'SEND_FILE'; file: File }
  | { type: 'SEND_CANCEL' }
  | { type: 'SWITCH_TAB'; tab: 'room' | 'print' }

// Actor input types — used by actor.ts when providing implementations
export interface RoomActorInput { roomId: string }
export interface FileTransferActorInput { file: File }

export const printerPartyMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
    input: {} as { initialRoomId: string },
  },
  actors: {
    // Placeholder implementations — overridden via machine.provide() in actor.ts
    printerRoomActor: fromCallback<AppEvent, RoomActorInput>(() => () => {}),
    printingRoomActor: fromCallback<AppEvent, RoomActorInput>(() => () => {}),
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
    setPrinterRoomId: assign({
      printerRoomId: ({ event }) => (event.type === 'JOIN_ROOM' ? event.roomId : ''),
    }),
    setPrintingRoomId: assign({
      printingRoomId: ({ event }) => {
        if (event.type === 'QR_DETECTED' || event.type === 'JOIN_ROOM') return event.roomId
        return ''
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
    printerRoomId: input.initialRoomId,
    printingRoomId: '',
    peers: new Set<string>(),
    fileToSend: null,
    sendProgress: 0,
    activeTab: 'print' as const,
  }),
  on: {
    SWITCH_TAB: { actions: 'switchTab' },
    PEER_JOINED: { actions: 'addPeer' },
    PEER_LEFT: { actions: 'removePeer' },
  },
  initial: 'printer',
  states: {
    // This device owns the room and auto-prints received files.
    printer: {
      invoke: {
        id: 'printerRoom',
        src: 'printerRoomActor',
        input: ({ context }): RoomActorInput => ({ roomId: context.printerRoomId }),
      },
      on: {
        DISCONNECT: {
          target: 'printer',
          reenter: true,
          actions: 'clearPeers',
        },
        JOIN_ROOM: {
          target: 'printer',
          reenter: true,
          actions: ['setPrinterRoomId', 'clearPeers'],
        },
        QR_DETECTED: {
          target: 'printing',
          actions: ['setPrintingRoomId', 'clearPeers'],
        },
      },
      initial: 'waiting',
      states: {
        waiting: {
          always: [{ guard: 'hasPeers', target: 'connected' }],
        },
        connected: {
          tags: ['printer-connected'],
          always: [{ guard: 'noPeers', target: 'waiting' }],
        },
      },
    },

    // This device joined a printer's room and sends files to it.
    printing: {
      invoke: {
        id: 'printingRoom',
        src: 'printingRoomActor',
        input: ({ context }): RoomActorInput => ({ roomId: context.printingRoomId }),
      },
      on: {
        DISCONNECT: {
          target: 'printer',
          actions: 'clearPeers',
        },
        JOIN_ROOM: {
          target: 'printing',
          reenter: true,
          actions: ['setPrintingRoomId', 'clearPeers'],
        },
        QR_DETECTED: {
          target: 'printing',
          reenter: true,
          actions: ['setPrintingRoomId', 'clearPeers'],
        },
      },
      initial: 'connecting',
      states: {
        // Waiting for the printer peer to connect.
        connecting: {
          always: [{ guard: 'hasPeers', target: 'connected' }],
        },

        // Printer peer is connected; ready to send files.
        connected: {
          tags: ['peer-connected'],
          always: [{ guard: 'noPeers', target: 'connecting' }],
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
              tags: ['sending'],
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
