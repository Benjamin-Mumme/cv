import {
  columnXZ,
  contractMult,
  DRILL,
  GRID,
  nextCost,
  PULSE,
  RIG,
  type TrackId,
} from './economy'
import { sackBlocked, sackCap, surfaceBlock, type GameState } from './state'

export type BreakEvent = {
  index: number
  x: number
  z: number
  depth: number
  name: string
  value: number
  paid: number
  rare: boolean
  color: string
}

export type DigMode = 'single' | 'spread' | 'flat'

const MAX_BREAKS = 4

export function neighbors(index: number, radius: number): number[] {
  const { x, z } = columnXZ(index)
  const out: number[] = []
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx
      const nz = z + dz
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue
      out.push(nz * GRID + nx)
    }
  }
  return out
}

/** Weights sum to 1 so a wider bit covers ground without printing money. */
export function spreadWeights(index: number, radius: number): { index: number; weight: number }[] {
  const cells = neighbors(index, radius)
  if (cells.length === 1) return [{ index: cells[0], weight: 1 }]
  const rest = 0.45 / (cells.length - 1)
  return cells.map((cell) => ({
    index: cell,
    weight: cell === index ? 0.55 : rest,
  }))
}

export function sellSack(state: GameState): number {
  if (state.sackUnits <= 0 || state.levels.haul >= 2) return 0
  const paid = state.sackValue * contractMult(state.levels.contract)
  state.cash += paid
  state.stats.earned += paid
  state.sackUnits = 0
  state.sackValue = 0
  return paid
}

export function tryBuy(state: GameState, id: TrackId): boolean {
  const cost = nextCost(id, state.levels[id])
  if (cost == null || state.cash < cost) return false
  state.cash -= cost
  state.levels[id] += 1
  if (id === 'rig' && state.rigColumn == null) state.placingRig = true
  return true
}

export function applyDamage(
  state: GameState,
  index: number,
  amount: number,
  mode: DigMode,
  radius: number,
): BreakEvent[] {
  if (amount <= 0 || index < 0) return []
  if (mode === 'single' || radius <= 0) return damageOne(state, index, amount)
  if (mode === 'flat') {
    const events: BreakEvent[] = []
    for (const cell of neighbors(index, radius)) events.push(...damageOne(state, cell, amount))
    return events
  }
  const events: BreakEvent[] = []
  for (const cell of spreadWeights(index, radius)) {
    events.push(...damageOne(state, cell.index, amount * cell.weight))
  }
  return events
}

function damageOne(state: GameState, index: number, amount: number): BreakEvent[] {
  const events: BreakEvent[] = []
  let left = amount
  let breaks = 0
  while (left > 0.0001 && breaks < MAX_BREAKS) {
    if (sackBlocked(state)) break
    const block = surfaceBlock(state, index)
    const need = block.hp - state.crack[index]
    if (need <= 0) {
      state.crack[index] = 0
      continue
    }
    if (left < need) {
      state.crack[index] += left
      break
    }
    left -= need
    breaks += 1
    events.push(breakBlock(state, index, block))
  }
  return events
}

function breakBlock(
  state: GameState,
  index: number,
  block: ReturnType<typeof surfaceBlock>,
): BreakEvent {
  const { x, z } = columnXZ(index)
  const depth = state.depths[index]
  state.depths[index] = depth + 1
  state.crack[index] = 0
  state.stats.dug += 1
  if (depth + 1 > state.stats.bestDepth) state.stats.bestDepth = depth + 1

  let paid = 0
  if (state.levels.haul >= 2) {
    paid = block.value * contractMult(state.levels.contract)
    state.cash += paid
    state.stats.earned += paid
  } else {
    state.sackUnits += 1
    state.sackValue += block.value
    if (state.levels.haul === 1 && state.sackUnits >= sackCap(state)) paid = sellSack(state)
  }

  return {
    index,
    x,
    z,
    depth,
    name: block.name,
    value: block.value,
    paid,
    rare: block.rare,
    color: block.color,
  }
}

export function updatePlayer(
  state: GameState,
  dt: number,
  holding: boolean,
  hover: number | null,
): BreakEvent[] {
  if (!holding || hover == null || state.placingRig) return []
  const drill = DRILL[state.levels.drill]
  return applyDamage(state, hover, drill.dps * dt, drill.radius > 0 ? 'spread' : 'single', drill.radius)
}

export function firePulse(state: GameState, index: number | null): BreakEvent[] {
  if (state.pulseCd > 0 || index == null) return []
  const pulse = PULSE[state.levels.pulse]
  state.pulseCd = pulse.cd
  return applyDamage(state, index, pulse.dmg, 'flat', pulse.radius)
}

export function tickPulse(state: GameState, dt: number, autoTarget: number | null): BreakEvent[] {
  if (state.pulseCd > 0) state.pulseCd = Math.max(0, state.pulseCd - dt)
  if (!PULSE[state.levels.pulse].auto) return []
  return firePulse(state, autoTarget)
}

export function rigDig(state: GameState, dt: number): BreakEvent[] {
  if (state.rigColumn == null) return []
  const rig = RIG[state.levels.rig]
  if (rig.dps <= 0) return []
  return applyDamage(state, state.rigColumn, rig.dps * dt, 'single', 0)
}

export function plantRig(state: GameState, index: number): boolean {
  if (state.levels.rig <= 0) return false
  state.rigColumn = index
  state.placingRig = false
  return true
}
