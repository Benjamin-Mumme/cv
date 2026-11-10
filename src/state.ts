import { assayOf, blockAt, columnXZ, GRID, SACK, type TrackId } from './economy'

export type UpgradeLevels = Record<TrackId, number>

export type GameState = {
  cash: number
  depths: number[]
  crack: number[]
  sackUnits: number
  sackValue: number
  levels: UpgradeLevels
  rigColumn: number | null
  placingRig: boolean
  pulseCd: number
  stats: { dug: number; bestDepth: number; earned: number }
  seen: string[]
}

export function freshLevels(): UpgradeLevels {
  return {
    drill: 0,
    sack: 0,
    haul: 0,
    drones: 0,
    rig: 0,
    assay: 0,
    contract: 0,
    pulse: 0,
  }
}

export function freshState(): GameState {
  return {
    cash: 0,
    depths: Array.from({ length: GRID * GRID }, () => 0),
    crack: Array.from({ length: GRID * GRID }, () => 0),
    sackUnits: 0,
    sackValue: 0,
    levels: freshLevels(),
    rigColumn: null,
    placingRig: false,
    pulseCd: 0,
    stats: { dug: 0, bestDepth: 0, earned: 0 },
    seen: [],
  }
}

export function sackBlocked(state: GameState): boolean {
  if (state.levels.haul >= 2) return false
  const cap = sackCap(state)
  return state.sackUnits >= cap
}

export function sackCap(state: GameState): number {
  return SACK[Math.min(state.levels.sack, SACK.length - 1)].cap
}

export function surfaceBlock(state: GameState, index: number) {
  const { x, z } = columnXZ(index)
  return blockAt(x, z, state.depths[index], assayOf(state.levels.assay))
}
