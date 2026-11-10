import { contractMult, formatMoney, nextStratum, PULSE } from './economy'
import { sackCap, type GameState } from './state'
import { priceLabel, shopCards, type ShopCard } from './upgrades'

export class Hud {
  private readonly cash: HTMLElement
  private readonly sackLabel: HTMLElement
  private readonly worth: HTMLElement
  private readonly fill: HTMLElement
  private readonly depth: HTMLElement
  private readonly next: HTMLElement
  private readonly rate: HTMLElement
  private readonly haul: HTMLButtonElement
  private readonly pulse: HTMLElement
  private readonly shop: HTMLElement
  private readonly toasts: HTMLElement
  private readonly banner: HTMLElement
  private readonly reset: HTMLButtonElement
  private readonly floaterLayer: HTMLElement
  private shopSig = ''
  private resetArm = 0
  private readonly floaters: Floater[] = []

  constructor(
    root: HTMLElement,
    handlers: {
      buy: (id: string) => void
      haul: () => void
      reset: () => void
      moveRig: () => void
    },
  ) {
    root.innerHTML = `
      <div class="vignette"></div>
      <header class="readout">
        <p class="brand">BORE</p>
        <p class="tag">a hole that learns to dig</p>
        <p class="cash" id="cash">$0</p>
        <div class="meta">
          <span id="sack-label">sack 0/8</span>
          <span id="worth"></span>
        </div>
        <div class="bar"><div id="sack-fill"></div></div>
        <p class="depth" id="depth">0 m deep</p>
        <p class="next" id="next-strata"></p>
        <p class="rate" id="rate">$0/s</p>
        <p class="pulse" id="pulse">pulse ready</p>
        <button id="haul" type="button">Haul sack <kbd>F</kbd></button>
      </header>
      <div id="toasts"></div>
      <div id="banner" hidden>Click a column to plant the rig</div>
      <aside id="shop"></aside>
      <footer class="hint">
        <span>Hold the ground</span>
        <span><kbd>Space</kbd> pulse</span>
        <span><kbd>F</kbd> haul</span>
        <span><kbd>Q</kbd> <kbd>E</kbd> look along the shaft</span>
        <button id="reset" type="button">Abandon claim</button>
      </footer>
      <div id="floaters"></div>
    `
    this.cash = must(root, '#cash')
    this.sackLabel = must(root, '#sack-label')
    this.worth = must(root, '#worth')
    this.fill = must(root, '#sack-fill')
    this.depth = must(root, '#depth')
    this.next = must(root, '#next-strata')
    this.rate = must(root, '#rate')
    this.haul = must(root, '#haul') as HTMLButtonElement
    this.pulse = must(root, '#pulse')
    this.shop = must(root, '#shop')
    this.toasts = must(root, '#toasts')
    this.banner = must(root, '#banner')
    this.reset = must(root, '#reset') as HTMLButtonElement
    this.floaterLayer = must(root, '#floaters')

    this.haul.addEventListener('click', () => handlers.haul())
    this.shop.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const move = target.closest('[data-move-rig]')
      if (move) {
        handlers.moveRig()
        return
      }
      const card = target.closest<HTMLElement>('[data-track]')
      if (card?.dataset.track) handlers.buy(card.dataset.track)
    })
    this.reset.addEventListener('click', () => {
      const now = performance.now()
      if (now - this.resetArm < 2400) {
        this.resetArm = 0
        this.reset.textContent = 'Abandon claim'
        handlers.reset()
      } else {
        this.resetArm = now
        this.reset.textContent = 'Click again to abandon'
      }
    })
  }

  toast(text: string): void {
    const el = document.createElement('p')
    el.className = 'toast'
    el.textContent = text
    this.toasts.appendChild(el)
    window.setTimeout(() => el.classList.add('show'), 20)
    window.setTimeout(() => {
      el.classList.remove('show')
      window.setTimeout(() => el.remove(), 400)
    }, 3600)
  }

  floater(text: string, x: number, y: number, z: number, kind: 'pay' | 'rare' | 'dirt'): void {
    const el = document.createElement('span')
    el.className = `floater ${kind}`
    el.textContent = text
    this.floaterLayer.appendChild(el)
    this.floaters.push({ el, life: 0.9, x, y, z, rise: 0 })
  }

  update(
    state: GameState,
    rate: number,
    project: (x: number, y: number, z: number) => { x: number; y: number; behind: boolean },
    dt: number,
  ): void {
    const cap = sackCap(state)
    const suction = state.levels.haul >= 2
    this.cash.textContent = formatMoney(state.cash)
    this.sackLabel.textContent = suction ? 'suction' : `sack ${state.sackUnits}/${cap}`
    const shown = state.sackValue * contractMult(state.levels.contract)
    this.worth.textContent = suction ? 'sells on break' : shown > 0 ? `worth ${formatMoney(shown)}` : ''
    const ratio = suction ? 0 : cap > 0 ? state.sackUnits / cap : 0
    this.fill.style.width = `${Math.min(100, ratio * 100)}%`
    this.fill.classList.toggle('full', !suction && state.sackUnits >= cap && cap > 0)
    this.depth.textContent = `${state.stats.bestDepth} m deep`
    const upcoming = nextStratum(state.stats.bestDepth)
    this.next.textContent = upcoming ? `${upcoming.name} at ${upcoming.at} m` : 'below this, only more void'
    this.rate.textContent = `${formatMoney(rate)}/s`
    const pulse = PULSE[state.levels.pulse]
    this.pulse.textContent =
      state.pulseCd > 0.05
        ? `pulse ${state.pulseCd.toFixed(1)}s`
        : pulse.auto
          ? 'pulse beats on its own'
          : 'pulse ready'
    this.haul.hidden = suction
    this.haul.disabled = state.sackUnits <= 0
    this.banner.hidden = !state.placingRig
    this.renderShop(state)
    this.placeFloaters(project, dt)
  }

  private renderShop(state: GameState): void {
    const cards = shopCards(state.levels)
    const sig = cards.map((card) => `${card.id}:${card.cost}:${card.title}`).join('|') + (state.placingRig ? ':place' : '')
    if (sig !== this.shopSig) {
      this.shopSig = sig
      this.shop.innerHTML = cards.map((card) => cardHtml(card, state)).join('')
    }
    for (const button of this.shop.querySelectorAll<HTMLButtonElement>('[data-cost]')) {
      const cost = Number(button.dataset.cost)
      const affordable = Number.isFinite(cost) && state.cash >= cost
      button.classList.toggle('affordable', affordable)
    }
  }

  private placeFloaters(
    project: (x: number, y: number, z: number) => { x: number; y: number; behind: boolean },
    dt: number,
  ): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const floater = this.floaters[i]
      floater.life -= dt
      floater.rise += dt * 36
      const p = project(floater.x, floater.y, floater.z)
      floater.el.style.transform = `translate(${p.x}px, ${p.y - floater.rise}px)`
      floater.el.style.opacity = p.behind ? '0' : String(Math.max(0, floater.life))
      if (floater.life <= 0) {
        floater.el.remove()
        this.floaters.splice(i, 1)
      }
    }
  }
}

function cardHtml(card: ShopCard, state: GameState): string {
  const move =
    card.id === 'rig' && state.levels.rig > 0
      ? `<span class="move" data-move-rig="1">${state.placingRig ? 'planting…' : 'move rig'}</span>`
      : ''
  const costAttr = card.cost == null ? '' : `data-cost="${card.cost}"`
  return `<button type="button" class="card${card.maxed ? ' maxed' : ''}" data-track="${card.id}" ${costAttr}>
    <span class="kicker">${card.index}</span>
    <span class="title">${card.title}</span>
    <span class="blurb">${card.blurb}</span>
    <span class="buyline"><span>${card.from} → ${card.to}</span><b>${priceLabel(card.cost, card.maxed)}</b></span>
    ${move}
  </button>`
}

function must(root: ParentNode, sel: string): HTMLElement {
  const el = root.querySelector(sel)
  if (!el) throw new Error(`Missing ${sel}`)
  return el as HTMLElement
}

type Floater = { el: HTMLElement; life: number; x: number; y: number; z: number; rise: number }
