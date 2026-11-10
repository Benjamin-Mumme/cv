import { describe, expect, it } from 'vitest'
import { applyDamage, sellSack, spreadWeights, tryBuy, updatePlayer } from './dig'
import {
  ASSAY,
  blockAt,
  DRONES,
  formatMoney,
  hash01,
  nextCost,
  STRATA,
  type TrackId,
} from './economy'
import { loadState, saveState, wipeState } from './save'
import { freshState, sackBlocked, sackCap } from './state'

const TRACKS: TrackId[] = ['drill', 'sack', 'haul', 'drones', 'rig', 'assay', 'contract', 'pulse']

describe('veins', () => {
  it('repeats the same block for the same column and depth', () => {
    expect(blockAt(3, 9, 42, 0.18)).toEqual(blockAt(3, 9, 42, 0.18))
    expect(hash01(1, 2, 3)).toBe(hash01(1, 2, 3))
  })

  it('finds more rares as assay rises, without moving a sure vein', () => {
    let low = 0
    let high = 0
    let promoted = 0
    for (let z = 0; z < 12; z++) {
      for (let x = 0; x < 12; x++) {
        for (let d = 0; d < 30; d++) {
          const a = blockAt(x, z, d, ASSAY[0].chance)
          const b = blockAt(x, z, d, ASSAY[ASSAY.length - 1].chance)
          if (a.rare) low++
          if (b.rare) high++
          if (a.rare && !b.rare) promoted++
        }
      }
    }
    expect(high).toBeGreaterThan(low)
    expect(promoted).toBe(0)
    expect(low).toBeGreaterThan(40)
  })

  it('pays more for a rare than the host rock', () => {
    const hosts = STRATA.map((stratum) => blockAt(0, 0, stratum.min, 0))
    for (const host of hosts) {
      const rare = blockAt(0, 0, STRATA.find((s) => s.id === host.stratum)!.min, 1)
      expect(rare.rare).toBe(true)
      expect(rare.value).toBeGreaterThan(host.value)
    }
  })
})

describe('upgrades', () => {
  it('grows more expensive down every track', () => {
    for (const id of TRACKS) {
      let level = 0
      let prev = -1
      for (;;) {
        const cost = nextCost(id, level)
        if (cost == null) break
        expect(cost).toBeGreaterThan(prev)
        prev = cost
        level++
      }
      expect(level).toBeGreaterThan(0)
    }
  })

  it('spreads a wide drill across a footprint that still sums to one', () => {
    const weights = spreadWeights(20, 2)
    const sum = weights.reduce((total, cell) => total + cell.weight, 0)
    expect(sum).toBeCloseTo(1)
    expect(weights.find((cell) => cell.index === 20)?.weight).toBeGreaterThan(0.5)
  })
})

describe('digging', () => {
  it('fills the sack until someone hauls it', () => {
    const state = freshState()
    while (state.sackUnits < sackCap(state)) applyDamage(state, 0, 50, 'single', 0)
    expect(sackBlocked(state)).toBe(true)
    expect(state.cash).toBe(0)
    const paid = sellSack(state)
    expect(paid).toBeGreaterThan(0)
    expect(state.cash).toBeCloseTo(paid)
    expect(state.sackUnits).toBe(0)
  })

  it('auto-hauls when the sack fills and sucks ore straight to cash', () => {
    const state = freshState()
    state.levels.haul = 1
    while (!sackBlocked(state) && state.cash === 0 && state.stats.dug < 30) {
      applyDamage(state, 4, 50, 'single', 0)
    }
    expect(state.cash).toBeGreaterThan(0)
    expect(state.sackUnits).toBe(0)

    const suction = freshState()
    suction.levels.haul = 2
    suction.levels.contract = 1
    const [broke] = applyDamage(suction, 2, 50, 'single', 0)
    expect(broke.paid).toBeCloseTo(broke.value * 1.3)
    expect(suction.sackUnits).toBe(0)
  })

  it('sells the first drill within the opening minute of steady digging', () => {
    const state = freshState()
    let boughtAt = -1
    const dt = 0.2
    for (let t = 0; t < 60 && boughtAt < 0; t += dt) {
      if (sackBlocked(state)) sellSack(state)
      const shallow = shallowest(state.depths)
      updatePlayer(state, dt, true, shallow)
      if (tryBuy(state, 'drill')) boughtAt = t
    }
    expect(boughtAt).toBeGreaterThan(8)
    expect(boughtAt).toBeLessThan(50)
  })

  it('can hire a drone and stop hauling by hand inside ten minutes', () => {
    const state = freshState()
    const order: TrackId[] = [
      'drill',
      'sack',
      'pulse',
      'drill',
      'haul',
      'assay',
      'sack',
      'drill',
      'drones',
      'contract',
      'haul',
    ]
    let step = 0
    let tDrone = -1
    let tHaul = -1
    const dt = 0.25
    for (let t = 0; t < 600; t += dt) {
      let bought = true
      while (bought && step < order.length) {
        bought = tryBuy(state, order[step])
        if (bought) {
          if (order[step] === 'drones' && state.levels.drones === 1) tDrone = t
          if (order[step] === 'haul' && state.levels.haul === 1) tHaul = t
          step++
        }
      }
      if (sackBlocked(state)) sellSack(state)
      updatePlayer(state, dt, true, shallowest(state.depths))
      const crew = DRONES[state.levels.drones]
      if (crew.count > 0 && !sackBlocked(state)) {
        for (let n = 0; n < crew.count; n++) {
          applyDamage(state, shallowest(state.depths), crew.dps * dt, 'single', 0)
        }
      }
    }
    expect(tHaul).toBeGreaterThan(20)
    expect(tHaul).toBeLessThan(240)
    expect(tDrone).toBeGreaterThan(60)
    expect(tDrone).toBeLessThan(480)
    expect(state.levels.haul).toBeGreaterThanOrEqual(1)
    expect(state.levels.drones).toBeGreaterThanOrEqual(1)
    expect(state.stats.bestDepth).toBeGreaterThan(5)
  })
})

describe('save', () => {
  it('round-trips the hole', () => {
    const memory = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return memory.size
      },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      key: (index) => [...memory.keys()][index] ?? null,
      removeItem: (key) => memory.delete(key),
      setItem: (key, value) => memory.set(key, value),
    }
    viStub(storage)
    wipeState()
    const state = freshState()
    state.cash = 42
    state.depths[5] = 12
    state.levels.drill = 2
    state.seen.push('depth-10')
    saveState(state)
    const loaded = loadState()
    expect(loaded.cash).toBe(42)
    expect(loaded.depths[5]).toBe(12)
    expect(loaded.levels.drill).toBe(2)
    expect(loaded.stats.bestDepth).toBe(12)
    expect(loaded.seen).toContain('depth-10')
    expect(formatMoney(1500)).toBe('$1.50k')
  })
})

function shallowest(depths: number[]): number {
  let best = 0
  for (let i = 1; i < depths.length; i++) if (depths[i] < depths[best]) best = i
  return best
}

function viStub(storage: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}
