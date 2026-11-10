import {
  ASSAY,
  CONTRACT,
  DRILL,
  DRONES,
  formatMoney,
  HAUL,
  nextCost,
  PULSE,
  RIG,
  SACK,
  type TrackId,
} from './economy'
import type { UpgradeLevels } from './state'

export type ShopCard = {
  id: TrackId
  index: string
  title: string
  blurb: string
  from: string
  to: string
  cost: number | null
  maxed: boolean
}

const ORDER: TrackId[] = ['drill', 'sack', 'haul', 'drones', 'assay', 'contract', 'pulse', 'rig']

export function shopCards(levels: UpgradeLevels): ShopCard[] {
  return ORDER.map((id, i) => describe(id, levels[id], String(i + 1).padStart(2, '0')))
}

function describe(id: TrackId, level: number, index: string): ShopCard {
  const cost = nextCost(id, level)
  const maxed = cost == null
  switch (id) {
    case 'drill': {
      const now = DRILL[level]
      const nxt = DRILL[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb: nxt
          ? nxt.radius > now.radius
            ? `Chews a ${nxt.radius} tile ring around the cursor.`
            : 'More bite. The same boring motion, sooner.'
          : 'The spoon has become a geological event.',
        from: `${trim(now.dps)} /s`,
        to: nxt ? `${trim(nxt.dps)} /s` : 'max',
        cost,
        maxed,
      }
    }
    case 'sack': {
      const now = SACK[level]
      const nxt = SACK[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb: 'How much ore you can hold before the hole has to wait.',
        from: `${now.cap}`,
        to: nxt ? `${nxt.cap}` : 'max',
        cost,
        maxed,
      }
    }
    case 'haul': {
      const now = HAUL[level]
      const nxt = HAUL[level + 1]
      const blurb =
        level === 0
          ? 'Walk the sack to the refinery. Press F, or click the shed.'
          : level === 1
            ? 'The sack sells itself the moment it fills.'
            : 'Ore becomes cash as it breaks. The sack is a museum piece.'
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb,
        from: now.name,
        to: nxt ? nxt.name : 'max',
        cost,
        maxed,
      }
    }
    case 'drones': {
      const now = DRONES[level]
      const nxt = DRONES[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb: nxt
          ? nxt.count === 1
            ? 'Hires a lamp with ambition. It digs the shallow floor, and stops if your sack is full.'
            : `${nxt.count} drones at ${trim(nxt.dps)} bite/s each.`
          : 'Eight lamps. None of them need you.',
        from: now.count ? `${now.count} × ${trim(now.dps)}` : 'none',
        to: nxt ? `${nxt.count} × ${trim(nxt.dps)}` : 'max',
        cost,
        maxed,
      }
    }
    case 'assay': {
      const now = ASSAY[level]
      const nxt = ASSAY[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb: 'Veins were always there. You just start agreeing to see them.',
        from: `${Math.round(now.chance * 100)}%`,
        to: nxt ? `${Math.round(nxt.chance * 100)}%` : 'max',
        cost,
        maxed,
      }
    }
    case 'contract': {
      const now = CONTRACT[level]
      const nxt = CONTRACT[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb: 'Same rocks. A ruder invoice.',
        from: `×${trim(now.mult)}`,
        to: nxt ? `×${trim(nxt.mult)}` : 'max',
        cost,
        maxed,
      }
    }
    case 'pulse': {
      const now = PULSE[level]
      const nxt = PULSE[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb: nxt?.auto
          ? 'The hole inhales on its own. Space still works if you miss the feeling.'
          : 'Space slams every block under the cursor. Flat damage, short cooldown.',
        from: `${trim(now.dmg)} dmg`,
        to: nxt ? `${trim(nxt.dmg)} dmg` : 'max',
        cost,
        maxed,
      }
    }
    case 'rig': {
      const now = RIG[level]
      const nxt = RIG[level + 1]
      return {
        id,
        index,
        title: nxt?.name ?? now.name,
        blurb:
          level === 0
            ? 'A drill that never gets bored. Plant it on a column.'
            : 'It only knows one column, and it knows it very well.',
        from: now.dps ? `${trim(now.dps)} /s` : 'none',
        to: nxt ? `${trim(nxt.dps)} /s` : 'max',
        cost,
        maxed,
      }
    }
  }
}

function trim(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
}

export function priceLabel(cost: number | null, maxed: boolean): string {
  if (maxed || cost == null) return 'MAX'
  return formatMoney(cost)
}
