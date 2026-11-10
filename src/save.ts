import {
  ASSAY,
  CONTRACT,
  DRILL,
  DRONES,
  GRID,
  HAUL,
  PULSE,
  RIG,
  SACK,
  type TrackId,
} from './economy'
import { freshState, type GameState, type UpgradeLevels } from './state'

const KEY = 'bore-save-v1'

const MAX: Record<TrackId, number> = {
  drill: DRILL.length - 1,
  sack: SACK.length - 1,
  haul: HAUL.length - 1,
  drones: DRONES.length - 1,
  rig: RIG.length - 1,
  assay: ASSAY.length - 1,
  contract: CONTRACT.length - 1,
  pulse: PULSE.length - 1,
}

type SaveBlob = {
  v: 1
  cash: number
  depths: number[]
  crack: number[]
  sackUnits: number
  sackValue: number
  levels: UpgradeLevels
  rigColumn: number | null
  placingRig: boolean
  stats: GameState['stats']
  seen: string[]
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const blob = JSON.parse(raw) as Partial<SaveBlob>
    if (blob.v !== 1) return freshState()
    return hydrate(blob)
  } catch {
    return freshState()
  }
}

export function saveState(state: GameState): void {
  const blob: SaveBlob = {
    v: 1,
    cash: state.cash,
    depths: state.depths,
    crack: state.crack,
    sackUnits: state.sackUnits,
    sackValue: state.sackValue,
    levels: state.levels,
    rigColumn: state.rigColumn,
    placingRig: state.placingRig,
    stats: state.stats,
    seen: state.seen,
  }
  localStorage.setItem(KEY, JSON.stringify(blob))
}

export function wipeState(): GameState {
  localStorage.removeItem(KEY)
  return freshState()
}

function hydrate(blob: Partial<SaveBlob>): GameState {
  const state = freshState()
  const cells = GRID * GRID
  if (!Array.isArray(blob.depths) || blob.depths.length !== cells) return state
  state.cash = finite(blob.cash, 0)
  state.depths = blob.depths.map((d) => Math.max(0, Math.floor(finite(d, 0))))
  state.crack = Array.from({ length: cells }, (_, i) => Math.max(0, finite(blob.crack?.[i], 0)))
  state.sackUnits = Math.max(0, Math.floor(finite(blob.sackUnits, 0)))
  state.sackValue = Math.max(0, finite(blob.sackValue, 0))
  const levels = blob.levels
  if (levels) {
    for (const id of Object.keys(MAX) as TrackId[]) {
      state.levels[id] = Math.min(MAX[id], Math.max(0, Math.floor(finite(levels[id], 0))))
    }
  }
  const rig = blob.rigColumn
  state.rigColumn =
    state.levels.rig > 0 && typeof rig === 'number' && rig >= 0 && rig < cells ? Math.floor(rig) : null
  state.placingRig = Boolean(blob.placingRig) && state.levels.rig > 0 && state.rigColumn == null
  state.stats.dug = Math.max(0, Math.floor(finite(blob.stats?.dug, 0)))
  state.stats.earned = Math.max(0, finite(blob.stats?.earned, 0))
  state.stats.bestDepth = state.depths.reduce((m, d) => Math.max(m, d), 0)
  state.seen = Array.isArray(blob.seen) ? blob.seen.filter((s) => typeof s === 'string') : []
  return state
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
