import { useSelector } from '@xstate/react'
import { actor } from '../scripts/actor'

export default function TabNav() {
  const activeTab = useSelector(actor, (s) => s.context.activeTab)

  return (
    <nav id="tabs">
      <button
        class={`tab${activeTab === 'room' ? ' active' : ''}`}
        onClick={() => actor.send({ type: 'SWITCH_TAB', tab: 'room' })}
      >
        Share Printer
      </button>
      <button
        class={`tab${activeTab === 'print' ? ' active' : ''}`}
        onClick={() => actor.send({ type: 'SWITCH_TAB', tab: 'print' })}
      >
        Print File
      </button>
    </nav>
  )
}
