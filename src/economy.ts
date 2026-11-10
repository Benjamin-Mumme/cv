export const GRID = 12
export const CELL = 1
export const STEP = 0.7

export type TrackId =
  | 'drill'
  | 'sack'
  | 'haul'
  | 'drones'
  | 'rig'
  | 'assay'
  | 'contract'
  | 'pulse'

export type DrillTier = { name: string; dps: number; radius: number; cost?: number }
export type SackTier = { name: string; cap: number; cost?: number }
export type HaulTier = { name: string; mode: 'manual' | 'auto-full' | 'suction'; cost?: number }
export type DroneTier = { name: string; count: number; dps: number; cost?: number }
export type RigTier = { name: string; dps: number; cost?: number }
export type AssayTier = { name: string; chance: number; cost?: number }
export type ContractTier = { name: string; mult: number; cost?: number }
export type PulseTier = {
  name: string
  cd: number
  radius: number
  dmg: number
  auto: boolean
  cost?: number
}

export const DRILL: DrillTier[] = [
  { name: 'Tin spoon', dps: 1.35, radius: 0 },
  { name: 'Iron bit', dps: 2.1, radius: 0, cost: 16 },
  { name: 'Steel auger', dps: 4.4, radius: 0, cost: 48 },
  { name: 'Wide head', dps: 8, radius: 1, cost: 150 },
  { name: 'Quarry bit', dps: 14, radius: 1, cost: 460 },
  { name: 'Bore crown', dps: 24, radius: 2, cost: 1400 },
  { name: 'Mantle tooth', dps: 42, radius: 2, cost: 4200 },
  { name: 'Singularity bit', dps: 75, radius: 3, cost: 13000 },
]

export const SACK: SackTier[] = [
  { name: 'Pockets', cap: 8 },
  { name: 'Satchel', cap: 18, cost: 20 },
  { name: 'Hopper', cap: 40, cost: 85 },
  { name: 'Skip', cap: 90, cost: 280 },
  { name: 'Cart', cap: 200, cost: 900 },
  { name: 'Freighter', cap: 500, cost: 2800 },
]

export const HAUL: HaulTier[] = [
  { name: 'By hand', mode: 'manual' },
  { name: 'Auto-haul', mode: 'auto-full', cost: 70 },
  { name: 'Suction line', mode: 'suction', cost: 360 },
]

export const DRONES: DroneTier[] = [
  { name: 'No crew', count: 0, dps: 0 },
  { name: 'One drone', count: 1, dps: 0.65, cost: 180 },
  { name: 'Pair', count: 2, dps: 0.85, cost: 420 },
  { name: 'Crew', count: 3, dps: 1.1, cost: 980 },
  { name: 'Shift', count: 4, dps: 1.4, cost: 2200 },
  { name: 'Swarm', count: 5, dps: 1.8, cost: 5000 },
  { name: 'Fleet', count: 6, dps: 2.3, cost: 11000 },
  { name: 'Colony', count: 7, dps: 3, cost: 24000 },
  { name: 'Excavation choir', count: 8, dps: 4, cost: 52000 },
]

export const RIG: RigTier[] = [
  { name: 'No rig', dps: 0 },
  { name: 'Stationary bore', dps: 10, cost: 7500 },
  { name: 'Hardened bore', dps: 26, cost: 18000 },
  { name: 'Core lance', dps: 60, cost: 46000 },
  { name: 'Event horizon', dps: 140, cost: 120000 },
]

export const ASSAY: AssayTier[] = [
  { name: 'Bare eyes', chance: 0.07 },
  { name: 'Hand lens', chance: 0.12, cost: 45 },
  { name: 'Field scanner', chance: 0.18, cost: 160 },
  { name: 'Vein map', chance: 0.26, cost: 640 },
  { name: 'Deep assay', chance: 0.36, cost: 2200 },
  { name: 'Prophecy', chance: 0.48, cost: 7500 },
]

export const CONTRACT: ContractTier[] = [
  { name: 'Spot price', mult: 1 },
  { name: 'Day rate', mult: 1.3, cost: 75 },
  { name: 'Futures', mult: 1.7, cost: 240 },
  { name: 'Exclusive', mult: 2.3, cost: 820 },
  { name: 'Cartel', mult: 3.2, cost: 2800 },
  { name: 'Moon monopoly', mult: 4.5, cost: 9500 },
]

export const PULSE: PulseTier[] = [
  { name: 'Stomp', cd: 14, radius: 1, dmg: 5, auto: false },
  { name: 'Slam', cd: 11, radius: 2, dmg: 14, auto: false, cost: 36 },
  { name: 'Shock', cd: 8, radius: 2, dmg: 36, auto: false, cost: 140 },
  { name: 'Quake', cd: 6, radius: 3, dmg: 90, auto: false, cost: 560 },
  { name: 'Breach', cd: 4.5, radius: 3, dmg: 200, auto: false, cost: 2100 },
  { name: 'Heartbeat', cd: 3, radius: 4, dmg: 480, auto: true, cost: 8000 },
]

export type Stratum = {
  id: string
  name: string
  min: number
  hp: number
  value: number
  rareName: string
  rareValue: number
  color: string
  rareColor: string
  rareEmissive: string
}

export const STRATA: Stratum[] = [
  {
    id: 'regolith',
    name: 'regolith',
    min: 0,
    hp: 2,
    value: 1,
    rareName: 'nickel pebble',
    rareValue: 7,
    color: '#c4b5a4',
    rareColor: '#f0d7a4',
    rareEmissive: '#e7b85a',
  },
  {
    id: 'clay',
    name: 'packed clay',
    min: 8,
    hp: 6,
    value: 3,
    rareName: 'geode',
    rareValue: 16,
    color: '#8d5b40',
    rareColor: '#e48aaa',
    rareEmissive: '#ff6b9a',
  },
  {
    id: 'stone',
    name: 'stone',
    min: 18,
    hp: 14,
    value: 7,
    rareName: 'copper',
    rareValue: 36,
    color: '#6a6762',
    rareColor: '#e8883a',
    rareEmissive: '#ff7a2a',
  },
  {
    id: 'iron',
    name: 'iron',
    min: 40,
    hp: 32,
    value: 16,
    rareName: 'magnetite',
    rareValue: 85,
    color: '#5a403c',
    rareColor: '#ff5a3c',
    rareEmissive: '#ff3b2f',
  },
  {
    id: 'titanium',
    name: 'titanium',
    min: 75,
    hp: 70,
    value: 38,
    rareName: 'rutile',
    rareValue: 200,
    color: '#3c4c58',
    rareColor: '#7ad8f0',
    rareEmissive: '#4ec8e8',
  },
  {
    id: 'gold',
    name: 'gold',
    min: 130,
    hp: 140,
    value: 90,
    rareName: 'nugget',
    rareValue: 480,
    color: '#8a6824',
    rareColor: '#ffe08a',
    rareEmissive: '#ffc14a',
  },
  {
    id: 'helium',
    name: 'helium glass',
    min: 200,
    hp: 280,
    value: 210,
    rareName: 'helium vial',
    rareValue: 1100,
    color: '#6a4a78',
    rareColor: '#f0c0ff',
    rareEmissive: '#d070ff',
  },
  {
    id: 'void',
    name: 'void crystal',
    min: 290,
    hp: 480,
    value: 460,
    rareName: 'void shard',
    rareValue: 2600,
    color: '#241830',
    rareColor: '#b49cff',
    rareEmissive: '#8a6cff',
  },
]

export const DEPTH_MILESTONES = [10, 25, 50, 100, 200, 400, 800] as const

export type Block = {
  name: string
  hp: number
  value: number
  color: string
  emissive: string | null
  rare: boolean
  stratum: string
}

export function columnIndex(x: number, z: number): number {
  return z * GRID + x
}

export function columnXZ(index: number): { x: number; z: number } {
  return { x: index % GRID, z: Math.floor(index / GRID) }
}

export function worldXZ(index: number): { x: number; z: number } {
  const { x, z } = columnXZ(index)
  const origin = (GRID - 1) * CELL * 0.5
  return { x: x * CELL - origin, z: z * CELL - origin }
}

/** Deterministic 0..1 hash. Same column and depth always yield the same vein. */
export function hash01(x: number, z: number, depth: number): number {
  let n =
    Math.imul(x + 1, 374761393) ^
    Math.imul(z + 1, 668265263) ^
    Math.imul(depth + 1, 1442695041)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n = (n ^ (n >>> 16)) >>> 0
  return n / 4294967296
}

export function stratumAt(depth: number): Stratum {
  let found = STRATA[0]
  for (const stratum of STRATA) {
    if (depth >= stratum.min) found = stratum
  }
  return found
}

export function nextStratum(depth: number): { name: string; at: number } | null {
  for (const stratum of STRATA) {
    if (stratum.min > depth) return { name: stratum.name, at: stratum.min }
  }
  return null
}

export function blockAt(x: number, z: number, depth: number, assayChance: number): Block {
  const stratum = stratumAt(depth)
  const rare = hash01(x, z, depth) < assayChance
  let hp = stratum.hp
  let value = stratum.value
  let rareValue = stratum.rareValue
  if (stratum.id === 'void') {
    const extra = depth - stratum.min
    hp += extra * 8
    value += extra * 6
    rareValue += extra * 28
  }
  const depthPay = 1 + depth * 0.04
  value = Math.max(1, Math.round(value * depthPay))
  rareValue = Math.max(value + 1, Math.round(rareValue * depthPay))
  return {
    name: rare ? stratum.rareName : stratum.name,
    hp: rare ? Math.max(hp + 1, Math.round(hp * 1.35)) : hp,
    value: rare ? rareValue : value,
    color: rare ? stratum.rareColor : stratum.color,
    emissive: rare ? stratum.rareEmissive : null,
    rare,
    stratum: stratum.id,
  }
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  const trim = (s: string) => s.replace(/\.0$/, '')
  if (v < 100) return sign + '$' + trim(v.toFixed(v < 10 && v % 1 !== 0 ? 1 : 0))
  if (v < 1000) return sign + '$' + Math.round(v)
  if (v < 10_000) return sign + '$' + trim((v / 1000).toFixed(2)) + 'k'
  if (v < 1_000_000) return sign + '$' + trim((v / 1000).toFixed(1)) + 'k'
  if (v < 1_000_000_000) return sign + '$' + trim((v / 1_000_000).toFixed(2)) + 'm'
  return sign + '$' + trim((v / 1_000_000_000).toFixed(2)) + 'b'
}

export function contractMult(level: number): number {
  return CONTRACT[clampLevel(level, CONTRACT.length)].mult
}

export function assayOf(level: number): number {
  return ASSAY[clampLevel(level, ASSAY.length)].chance
}

export function clampLevel(level: number, length: number): number {
  if (!Number.isFinite(level) || level < 0) return 0
  return Math.min(length - 1, Math.floor(level))
}

export function trackTable(id: TrackId): readonly { cost?: number }[] {
  switch (id) {
    case 'drill':
      return DRILL
    case 'sack':
      return SACK
    case 'haul':
      return HAUL
    case 'drones':
      return DRONES
    case 'rig':
      return RIG
    case 'assay':
      return ASSAY
    case 'contract':
      return CONTRACT
    case 'pulse':
      return PULSE
  }
}

export function nextCost(id: TrackId, level: number): number | null {
  const table = trackTable(id)
  const next = table[level + 1]
  if (!next || next.cost == null) return null
  return next.cost
}

export function milestoneText(depth: number): string | null {
  switch (depth) {
    case 10:
      return 'Ten meters. The dust is finally a hole.'
    case 25:
      return 'Twenty-five meters. Clay packs the walls.'
    case 50:
      return 'Fifty meters. Iron starts paying the rent.'
    case 100:
      return 'One hundred meters. The lamps matter now.'
    case 200:
      return 'Helium glass. Pretty, and slightly illegal.'
    case 400:
      return 'Four hundred meters. The void glitters back.'
    case 800:
      return 'Eight hundred meters. You are a rumor with a hole.'
    default:
      return null
  }
}
