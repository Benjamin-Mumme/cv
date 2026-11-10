import './style.css'
import { AudioBus } from './audio'
import { createDroneBodies, updateDrones } from './drones'
import {
  firePulse,
  plantRig,
  rigDig,
  sellSack,
  tickPulse,
  tryBuy,
  updatePlayer,
  type BreakEvent,
} from './dig'
import { DEPTH_MILESTONES, formatMoney, milestoneText, PULSE, type TrackId } from './economy'
import { loadState, saveState, wipeState } from './save'
import { sackBlocked, type GameState } from './state'
import { Hud } from './ui'
import { World } from './world'

const TRACKS: TrackId[] = ['drill', 'sack', 'haul', 'drones', 'assay', 'contract', 'pulse', 'rig']

const canvas = document.querySelector<HTMLCanvasElement>('#view')
const hudRoot = document.querySelector<HTMLElement>('#hud')
if (!canvas || !hudRoot) throw new Error('Missing game mount')

const world = new World(canvas)
const audio = new AudioBus()
const state = loadState()
const drones = createDroneBodies()
let holding = false
let hover: number | null = null
let lastHover: number | null = null
let saveAt = 0
let fullNag = 0
const samples: { t: number; v: number }[] = []

const hud = new Hud(hudRoot, {
  buy: (id) => {
    audio.ensure()
    if (!isTrack(id)) return
    const before = state.levels[id]
    if (!tryBuy(state, id)) {
      audio.deny()
      return
    }
    audio.buy()
    onPurchased(state, id, before)
  },
  haul: () => doSell(),
  reset: () => {
    const next = wipeState()
    copyState(state, next)
    hud.toast('The claim caves in. You start at the dust again.')
  },
  moveRig: () => {
    if (state.levels.rig <= 0) return
    state.placingRig = true
  },
})

window.addEventListener('resize', () => world.resize())
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  audio.ensure()
  const hit = world.pick(event.clientX, event.clientY)
  if (!hit) return
  if (hit.kind === 'refinery') {
    doSell()
    return
  }
  if (state.placingRig) {
    plantRig(state, hit.index)
    audio.buy()
    hud.toast('Rig planted. It only knows this column.')
    return
  }
  holding = true
  hover = hit.index
  lastHover = hit.index
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', (event) => {
  const hit = world.pick(event.clientX, event.clientY)
  hover = hit?.kind === 'column' ? hit.index : null
  if (hover != null) lastHover = hover
  world.hover = hover
})
window.addEventListener('pointerup', () => {
  holding = false
})
canvas.addEventListener('pointercancel', () => {
  holding = false
})
canvas.addEventListener('pointerleave', () => {
  if (!holding) {
    hover = null
    world.hover = null
  }
})
canvas.addEventListener('contextmenu', (event) => event.preventDefault())
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    world.lookBias -= Math.sign(event.deltaY) * 1.4
  },
  { passive: false },
)

const keys = new Set<string>()
window.addEventListener('keydown', (event) => {
  if (event.repeat) return
  keys.add(event.key.toLowerCase())
  if (event.key === ' ') {
    event.preventDefault()
    audio.ensure()
    const events = firePulse(state, aimColumn(state, lastHover))
    if (events.length === 0) audio.deny()
    else {
      audio.pulse()
      world.shake = Math.min(0.7, 0.25 + events.length * 0.03)
      absorb(events)
    }
  }
  if (event.key.toLowerCase() === 'f') doSell()
  const num = Number(event.key)
  if (num >= 1 && num <= 8) {
    audio.ensure()
    const id = TRACKS[num - 1]
    const before = state.levels[id]
    if (tryBuy(state, id)) {
      audio.buy()
      onPurchased(state, id, before)
    }
  }
})
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()))
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveState(state)
})
window.addEventListener('pagehide', () => saveState(state))

if (state.stats.dug === 0) {
  window.setTimeout(() => {
    if (state.stats.dug === 0) hud.toast('Hold the pale ground. Fill the sack. Haul it to the amber shed.')
  }, 600)
}

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (keys.has('q')) world.lookBias += dt * 6
  if (keys.has('e')) world.lookBias -= dt * 6
  const span = Math.max(4, state.stats.bestDepth * 0.7 + 2)
  world.lookBias = Math.max(-span, Math.min(6, world.lookBias))

  const digging = holding && hover != null && !state.placingRig
  if (digging) audio.hit()
  absorb(updatePlayer(state, dt, holding, hover))
  absorb(
    updateDrones(state, drones, dt, (index) => world.columnTop(index, state.depths[index])),
  )
  absorb(rigDig(state, dt))
  const autoEvents = tickPulse(state, dt, aimColumn(state, lastHover))
  if (autoEvents.length) {
    audio.pulse()
    world.shake = 0.2
    absorb(autoEvents)
  }

  if (sackBlocked(state) && now - fullNag > 4000) {
    fullNag = now
    hud.toast('Sack is full. Haul it, or the drones wait with you.')
  }

  noteMilestones(state)
  world.sync(state, drones)
  world.update(dt)
  world.render()
  hud.update(state, incomeRate(now), (x, y, z) => world.project(x, y, z), dt)

  if (now > saveAt) {
    saveState(state)
    saveAt = now + 2000
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

function absorb(events: BreakEvent[]): void {
  if (events.length === 0) return
  const rare = events.some((event) => event.rare)
  audio.break(rare)
  if (events.some((event) => event.paid > 0) && state.levels.haul >= 1) audio.sell()
  let shown = 0
  for (const event of events) {
    const top = world.columnTop(event.index, event.depth)
    world.burst(top.x, top.y, top.z, event.color, event.rare ? 16 : 8)
    if (shown < 6) {
      world.fling(top, event.color)
      const text = event.rare ? event.name : `+${formatMoney(event.value)}`
      hud.floater(text, top.x, top.y, top.z, event.rare ? 'rare' : 'dirt')
      shown++
    }
    if (event.paid > 0) samples.push({ t: performance.now(), v: event.paid })
  }
  if (rare) world.shake = Math.max(world.shake, 0.18)
  if (rare && !state.seen.includes('first-rare')) {
    state.seen.push('first-rare')
    const found = events.find((event) => event.rare)
    if (found) hud.toast(`A ${found.name}. Not all dirt is dirt.`)
  }
  noteMilestones(state)
}

function doSell(): void {
  audio.ensure()
  const paid = sellSack(state)
  if (paid <= 0) {
    audio.deny()
    return
  }
  audio.sell()
  samples.push({ t: performance.now(), v: paid })
  const shed = world.shedPoint()
  hud.floater(formatMoney(paid), shed.x, shed.y + 1.4, shed.z, 'pay')
  hud.toast(`Refinery pays ${formatMoney(paid)}.`)
}

function incomeRate(now: number): number {
  const cutoff = now - 5000
  while (samples.length && samples[0].t < cutoff) samples.shift()
  let sum = 0
  for (const sample of samples) sum += sample.v
  return sum / 5
}

function noteMilestones(state: GameState): void {
  for (const depth of DEPTH_MILESTONES) {
    const key = `depth-${depth}`
    if (state.stats.bestDepth >= depth && !state.seen.includes(key)) {
      state.seen.push(key)
      const text = milestoneText(depth)
      if (text) hud.toast(text)
    }
  }
  if (state.levels.drones >= 1 && state.levels.haul === 0 && !state.seen.includes('drone-wait')) {
    state.seen.push('drone-wait')
    hud.toast('Drone hired. It stops when the sack is full.')
  }
  if (state.levels.drones >= 1 && state.levels.haul >= 1 && !state.seen.includes('self-running')) {
    state.seen.push('self-running')
    hud.toast('The hole can work without your hands.')
  }
  if (PULSE[state.levels.pulse].auto && !state.seen.includes('heartbeat')) {
    state.seen.push('heartbeat')
    hud.toast('The pit found a heartbeat.')
  }
}

function onPurchased(state: GameState, id: TrackId, before: number): void {
  if (id === 'rig' && state.levels.rig === 1 && before === 0) {
    hud.toast('Click a column. The rig will not wander.')
  } else if (id === 'haul' && state.levels.haul === 2) {
    hud.toast('Suction online. Dirt is just slow money now.')
  } else if (id === 'assay') {
    hud.toast('The veins do not change. Your standards do.')
  }
  noteMilestones(state)
}

function aimColumn(state: GameState, preferred: number | null): number {
  if (preferred != null) return preferred
  if (state.rigColumn != null) return state.rigColumn
  let best = 0
  for (let i = 1; i < state.depths.length; i++) {
    if (state.depths[i] < state.depths[best]) best = i
  }
  return best
}

function isTrack(id: string): id is TrackId {
  return (TRACKS as string[]).includes(id)
}

function copyState(target: GameState, source: GameState): void {
  target.cash = source.cash
  target.depths = source.depths
  target.crack = source.crack
  target.sackUnits = source.sackUnits
  target.sackValue = source.sackValue
  target.levels = source.levels
  target.rigColumn = source.rigColumn
  target.placingRig = source.placingRig
  target.pulseCd = source.pulseCd
  target.stats = source.stats
  target.seen = source.seen
}
