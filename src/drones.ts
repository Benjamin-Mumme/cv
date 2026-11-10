import { DRONES, GRID } from './economy'
import { applyDamage, type BreakEvent } from './dig'
import { sackBlocked, type GameState } from './state'

export type DroneBody = {
  x: number
  y: number
  z: number
  column: number
  digging: boolean
}

export function createDroneBodies(): DroneBody[] {
  return Array.from({ length: 8 }, () => ({
    x: 0.4,
    y: 2.6,
    z: -7.4,
    column: -1,
    digging: false,
  }))
}

export function updateDrones(
  state: GameState,
  bodies: DroneBody[],
  dt: number,
  columnTop: (index: number) => { x: number; y: number; z: number },
): BreakEvent[] {
  const tier = DRONES[state.levels.drones]
  const events: BreakEvent[] = []
  const blocked = sackBlocked(state)
  const used = new Set<number>()

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]
    const active = i < tier.count
    if (!active) {
      body.digging = false
      body.column = -1
      continue
    }
    if (blocked) {
      body.digging = false
      const home = columnTop(0)
      home.x = 0.4
      home.y = 2.4
      home.z = -8.2
      stepTowards(body, home, dt, 7)
      continue
    }
    if (body.column < 0 || body.column >= GRID * GRID || taken(state, body.column, used)) {
      body.column = pickColumn(state, used)
    }
    used.add(body.column)
    const top = columnTop(body.column)
    const dest = { x: top.x, y: top.y + 2.15, z: top.z }
    const arrived = stepTowards(body, dest, dt, 8)
    body.digging = arrived
    if (arrived) events.push(...applyDamage(state, body.column, tier.dps * dt, 'single', 0))
  }
  return events
}

function taken(state: GameState, index: number, used: Set<number>): boolean {
  if (used.has(index)) return true
  let min = Infinity
  for (const depth of state.depths) if (depth < min) min = depth
  return state.depths[index] > min + 1
}

function pickColumn(state: GameState, used: Set<number>): number {
  let min = Infinity
  for (const depth of state.depths) if (depth < min) min = depth
  const pool: number[] = []
  for (let i = 0; i < state.depths.length; i++) {
    if (used.has(i)) continue
    if (state.depths[i] <= min + 1) pool.push(i)
  }
  if (pool.length === 0) {
    for (let i = 0; i < state.depths.length; i++) if (!used.has(i)) pool.push(i)
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? 0
}

function stepTowards(
  body: DroneBody,
  dest: { x: number; y: number; z: number },
  dt: number,
  speed: number,
): boolean {
  const dx = dest.x - body.x
  const dy = dest.y - body.y
  const dz = dest.z - body.z
  const dist = Math.hypot(dx, dy, dz)
  if (dist < 0.08) {
    body.x = dest.x
    body.y = dest.y
    body.z = dest.z
    return true
  }
  const step = Math.min(dist, speed * dt)
  body.x += (dx / dist) * step
  body.y += (dy / dist) * step
  body.z += (dz / dist) * step
  return false
}
