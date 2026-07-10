import { UI } from '../utils/Constants';
import type { Skin } from '../utils/Skins';


export class UISystem {
  private container: HTMLDivElement;
  private staminaBar: HTMLElement;
  private staminaText: HTMLElement;
  private autoSprintChip: HTMLElement;
  private coinCounter: HTMLElement;
  private dangerVignette: HTMLElement;
  private dangerFlash: HTMLElement;
  private timerText: HTMLElement;
  private objectiveText: HTMLElement;
  private fpsCounter: HTMLElement;
  private gameOverScreen: HTMLElement;
  private goCard!: HTMLElement;
  private goIcon!: HTMLElement;
  private goTitle!: HTMLElement;
  private goSub!: HTMLElement;
  private goTimeValue!: HTMLElement;
  private goBestValue!: HTMLElement;
  private goCoins!: HTMLElement;
  private goRecord!: HTMLElement;
  private goButton!: HTMLButtonElement;
  private goMenuButton!: HTMLButtonElement;
  private startScreen!: HTMLElement;
  private startBest!: HTMLElement;
  private startCoins!: HTMLElement;
  private shopRow!: HTMLElement;
  private startButtons: Array<{ el: HTMLButtonElement; count: number }> = [];
  private fpsFrameCount: number = 0;
  private fpsDeltaTime: number = 0;
  private static readonly BEST_TIME_KEY = 'ekuke-chase:best-time';

  constructor() {
    this.injectStyles();

    this.container = document.createElement('div');
    this.container.id = 'game-ui';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.fontFamily = "'Arial', sans-serif";
    this.container.style.zIndex = '100';
    document.body.appendChild(this.container);

    this.staminaBar = this.createHealthBar('player-stamina', true);

    this.staminaText = document.createElement('div');
    this.staminaText.style.position = 'absolute';
    this.staminaText.style.top = `${UI.PADDING + 50}px`;
    this.staminaText.style.left = `${UI.PADDING}px`;
    this.staminaText.style.color = '#ffffff';
    this.staminaText.style.fontSize = `${UI.FONT_SIZE}px`;
    this.staminaText.textContent = 'Stamina';
    this.container.appendChild(this.staminaText);

    this.autoSprintChip = document.createElement('div');
    this.autoSprintChip.className = 'auto-sprint-chip';
    this.autoSprintChip.style.position = 'absolute';
    this.autoSprintChip.style.top = `${UI.PADDING + 78}px`;
    this.autoSprintChip.style.left = `${UI.PADDING}px`;
    this.autoSprintChip.style.pointerEvents = 'auto';
    this.autoSprintChip.style.cursor = 'pointer';
    this.container.appendChild(this.autoSprintChip);

    this.timerText = document.createElement('div');
    this.timerText.style.position = 'absolute';
    this.timerText.style.top = `${UI.PADDING}px`;
    this.timerText.style.left = '50%';
    this.timerText.style.transform = 'translateX(-50%)';
    this.timerText.style.color = '#ffffff';
    this.timerText.style.fontSize = '34px';
    this.timerText.style.fontWeight = 'bold';
    this.timerText.style.fontFamily = "'Consolas', 'Courier New', monospace";
    this.timerText.style.textShadow = '0 2px 8px rgba(0,0,0,0.5)';
    this.timerText.textContent = '0.0s';
    this.container.appendChild(this.timerText);

    this.objectiveText = document.createElement('div');
    this.objectiveText.style.position = 'absolute';
    this.objectiveText.style.top = `${UI.PADDING + 40}px`;
    this.objectiveText.style.left = '50%';
    this.objectiveText.style.transform = 'translateX(-50%)';
    this.objectiveText.style.color = '#ffffff';
    this.objectiveText.style.fontSize = `${UI.FONT_SIZE}px`;
    this.objectiveText.style.opacity = '0.75';
    this.objectiveText.textContent = 'Run! Survive as long as you can';
    this.container.appendChild(this.objectiveText);

    // Danger feedback: a red edge-vignette that intensifies with proximity,
    // plus a brief flash on a near-miss.
    this.dangerVignette = document.createElement('div');
    this.dangerVignette.className = 'danger-vignette';
    this.container.appendChild(this.dangerVignette);

    this.dangerFlash = document.createElement('div');
    this.dangerFlash.className = 'danger-flash';
    this.container.appendChild(this.dangerFlash);

    this.coinCounter = document.createElement('div');
    this.coinCounter.className = 'coin-counter';
    this.coinCounter.style.position = 'absolute';
    this.coinCounter.style.top = `${UI.PADDING}px`;
    this.coinCounter.style.right = `${UI.PADDING}px`;
    this.coinCounter.textContent = '🪙 0';
    this.container.appendChild(this.coinCounter);

    this.fpsCounter = document.createElement('div');
    this.fpsCounter.style.position = 'absolute';
    this.fpsCounter.style.bottom = `${UI.PADDING}px`;
    this.fpsCounter.style.right = `${UI.PADDING}px`;
    this.fpsCounter.style.color = '#00ff00';
    this.fpsCounter.style.fontSize = `${UI.FONT_SIZE}px`;
    this.fpsCounter.style.fontFamily = "'Courier New', monospace";
    this.fpsCounter.textContent = 'FPS: 0';
    this.container.appendChild(this.fpsCounter);

    this.gameOverScreen = this.createGameOverScreen();
    this.startScreen = this.createStartScreen();
  }

  private createHealthBar(id: string, isPlayer: boolean): HTMLElement {
    const container = document.createElement('div');
    container.id = id;
    container.style.position = 'absolute';
    container.style.width = `${UI.HEALTH_BAR_WIDTH}px`;
    container.style.height = `${UI.HEALTH_BAR_HEIGHT}px`;
    container.style.border = '2px solid #333333';
    container.style.backgroundColor = '#1a1a1a';
    container.style.overflow = 'hidden';
    container.style.borderRadius = '4px';

    if (isPlayer) {
      container.style.top = `${UI.PADDING}px`;
      container.style.left = `${UI.PADDING}px`;
    } else {
      container.style.top = `${UI.PADDING}px`;
      container.style.right = `${UI.PADDING}px`;
    }

    const fill = document.createElement('div');
    fill.className = 'health-fill';
    fill.style.width = '100%';
    fill.style.height = '100%';
    fill.style.backgroundColor = isPlayer ? '#00ff00' : '#ff0000';
    fill.style.transition = 'width 0.3s ease-out';
    container.appendChild(fill);

    this.container.appendChild(container);
    return container;
  }

  private createGameOverScreen(): HTMLElement {
    const screen = document.createElement('div');
    screen.id = 'game-over-screen';
    screen.className = 'go-overlay';

    const card = document.createElement('div');
    card.className = 'go-card';

    const icon = document.createElement('div');
    icon.className = 'go-icon';

    const title = document.createElement('h1');
    title.className = 'go-title';

    const sub = document.createElement('p');
    sub.className = 'go-sub';

    const stats = document.createElement('div');
    stats.className = 'go-stats';

    const timeStat = document.createElement('div');
    timeStat.className = 'go-stat';
    const timeLabel = document.createElement('div');
    timeLabel.className = 'go-stat-label';
    timeLabel.textContent = 'You survived';
    const timeValue = document.createElement('div');
    timeValue.className = 'go-stat-value';
    timeStat.appendChild(timeLabel);
    timeStat.appendChild(timeValue);

    const bestStat = document.createElement('div');
    bestStat.className = 'go-stat';
    const bestLabel = document.createElement('div');
    bestLabel.className = 'go-stat-label';
    bestLabel.textContent = 'Best';
    const bestValue = document.createElement('div');
    bestValue.className = 'go-stat-value go-stat-best';
    bestStat.appendChild(bestLabel);
    bestStat.appendChild(bestValue);

    stats.appendChild(timeStat);
    stats.appendChild(bestStat);

    const coins = document.createElement('div');
    coins.className = 'go-coins';

    const record = document.createElement('div');
    record.className = 'go-record';
    record.textContent = '★ New best time!';

    const button = document.createElement('button');
    button.className = 'go-btn';
    button.textContent = 'Play again';

    const menuButton = document.createElement('button');
    menuButton.className = 'go-btn go-btn-secondary';
    menuButton.textContent = 'Main Menu';

    const hint = document.createElement('div');
    hint.className = 'go-hint';
    hint.textContent = 'Press Enter to play again';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(stats);
    card.appendChild(coins);
    card.appendChild(record);
    card.appendChild(button);
    card.appendChild(menuButton);
    card.appendChild(hint);
    screen.appendChild(card);
    this.container.appendChild(screen);

    this.goCard = card;
    this.goIcon = icon;
    this.goTitle = title;
    this.goSub = sub;
    this.goTimeValue = timeValue;
    this.goBestValue = bestValue;
    this.goCoins = coins;
    this.goRecord = record;
    this.goButton = button;
    this.goMenuButton = menuButton;

    return screen;
  }

  updateStamina(ratio: number, exhausted: boolean): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const fill = this.staminaBar.querySelector('.health-fill') as HTMLElement;
    if (fill) {
      fill.style.width = `${clamped * 100}%`;
      fill.style.backgroundColor = exhausted
        ? '#ff3b30'
        : clamped < 0.35
          ? '#ffb300'
          : '#00d26a';
    }
    this.staminaText.textContent = exhausted ? 'Exhausted!' : 'Stamina';
  }

  bindAutoSprint(onToggle: () => void): void {
    this.autoSprintChip.onclick = onToggle;
  }

  setAutoSprintDisplay(enabled: boolean): void {
    this.autoSprintChip.textContent = `🏃 Auto-Run: ${enabled ? 'ON' : 'OFF'}  (T)`;
    this.autoSprintChip.classList.toggle('on', enabled);
  }

  updateCoins(total: number, run: number): void {
    this.coinCounter.textContent = run > 0 ? `🪙 ${total}  (+${run})` : `🪙 ${total}`;
  }

  updateFPS(deltaTime: number): void {
    this.fpsFrameCount++;
    this.fpsDeltaTime += deltaTime;

    if (this.fpsDeltaTime >= 1) {
      const fps = Math.round(this.fpsFrameCount / this.fpsDeltaTime);
      this.fpsCounter.textContent = `FPS: ${fps}`;
      this.fpsFrameCount = 0;
      this.fpsDeltaTime = 0;
    }
  }

  updateScore(elapsedSeconds: number): void {
    this.timerText.textContent = `${Math.max(0, elapsedSeconds).toFixed(1)}s`;
  }

  /** Proximity danger, 0 (safe) → 1 (about to be caught). Drives the vignette. */
  setDangerLevel(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.dangerVignette.style.opacity = (clamped * 0.6).toFixed(3);
    this.dangerVignette.classList.toggle('pulse', clamped > 0.5);
  }

  /** Brief red flash when the player escapes a near-miss. */
  flashDanger(): void {
    this.dangerFlash.classList.remove('on');
    // Force reflow so re-adding the class restarts the animation.
    void this.dangerFlash.offsetWidth;
    this.dangerFlash.classList.add('on');
  }

  showGameOver(
    survivedSeconds: number,
    coinsThisRun: number,
    onRestart: () => void,
    onMenu: () => void
  ): void {
    const best = this.getBestTime();
    const isRecord = survivedSeconds > best + 0.05;
    if (isRecord) {
      this.setBestTime(survivedSeconds);
    }
    const bestToShow = Math.max(best, survivedSeconds);

    this.goCard.classList.remove('win');
    this.goCard.classList.add('lose');
    this.goIcon.textContent = '🐾';
    this.goTitle.textContent = 'Caught!';
    this.goSub.textContent = isRecord
      ? 'New personal best — outstanding run!'
      : 'The pack got you. Go again and beat your time.';
    this.goTimeValue.textContent = this.formatTime(survivedSeconds);
    this.goBestValue.textContent = this.formatTime(bestToShow);
    this.goCoins.textContent = coinsThisRun > 0 ? `🪙 +${coinsThisRun} coins collected` : '';
    this.goCoins.style.display = coinsThisRun > 0 ? 'block' : 'none';
    this.goRecord.style.display = isRecord ? 'block' : 'none';

    this.gameOverScreen.classList.add('visible');

    const cleanup = () => window.removeEventListener('keydown', onKey);
    const restart = () => {
      cleanup();
      this.hideGameOver();
      onRestart();
    };
    const toMenu = () => {
      cleanup();
      this.hideGameOver();
      onMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        restart();
      }
    };
    this.goButton.onclick = restart;
    this.goMenuButton.onclick = toMenu;
    window.addEventListener('keydown', onKey);
  }

  hideGameOver(): void {
    this.gameOverScreen.classList.remove('visible');
  }

  private createStartScreen(): HTMLElement {
    const screen = document.createElement('div');
    screen.id = 'start-screen';
    screen.className = 'go-overlay';

    const card = document.createElement('div');
    card.className = 'go-card win';

    const icon = document.createElement('div');
    icon.className = 'go-icon';
    icon.textContent = '🐕';

    const title = document.createElement('h1');
    title.className = 'go-title';
    title.textContent = 'Ekuke Chase';

    const sub = document.createElement('p');
    sub.className = 'go-sub';
    sub.textContent = 'How many dogs dare you outrun?';

    const choices = document.createElement('div');
    choices.className = 'sm-choices';
    for (const count of [1, 2, 3]) {
      const btn = document.createElement('button');
      btn.className = 'sm-btn';
      btn.innerHTML = `<span class="sm-num">${count}</span><span class="sm-cap">${count === 1 ? 'Dog' : 'Dogs'}</span>`;
      choices.appendChild(btn);
      this.startButtons.push({ el: btn, count });
    }

    const best = document.createElement('div');
    best.className = 'go-hint';
    this.startBest = best;

    // Skin shop: coin balance + a row of colour swatches.
    const shopHeader = document.createElement('div');
    shopHeader.className = 'shop-header';
    const shopLabel = document.createElement('span');
    shopLabel.textContent = 'Skins';
    const coinsLabel = document.createElement('span');
    coinsLabel.className = 'shop-coins';
    this.startCoins = coinsLabel;
    shopHeader.appendChild(shopLabel);
    shopHeader.appendChild(coinsLabel);

    const shopRow = document.createElement('div');
    shopRow.className = 'shop-row';
    this.shopRow = shopRow;

    const hint = document.createElement('div');
    hint.className = 'go-hint';
    hint.textContent = 'Survive as long as you can · Press 1 – 3';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(choices);
    card.appendChild(best);
    card.appendChild(shopHeader);
    card.appendChild(shopRow);
    card.appendChild(hint);
    screen.appendChild(card);
    this.container.appendChild(screen);
    return screen;
  }

  /** Render/refresh the skin shop swatches on the start menu. */
  renderShop(
    skins: Skin[],
    ownedIds: string[],
    selectedId: string,
    coins: number,
    onPick: (id: string) => void
  ): void {
    this.startCoins.textContent = `🪙 ${coins}`;
    this.shopRow.replaceChildren();

    for (const skin of skins) {
      const owned = ownedIds.includes(skin.id);
      const selected = skin.id === selectedId;

      const swatch = document.createElement('button');
      swatch.className = 'shop-swatch';
      if (selected) swatch.classList.add('selected');
      if (!owned) swatch.classList.add('locked');

      const dot = document.createElement('span');
      dot.className = 'shop-dot';
      dot.style.background = skin.color === null
        ? 'conic-gradient(#c9ccd2, #7f8794, #c9ccd2)'
        : `#${skin.color.toString(16).padStart(6, '0')}`;
      swatch.appendChild(dot);

      const tag = document.createElement('span');
      tag.className = 'shop-tag';
      tag.textContent = owned ? (selected ? '✓' : skin.name) : `🪙${skin.cost}`;
      if (!owned && coins < skin.cost) swatch.classList.add('unaffordable');
      swatch.appendChild(tag);

      swatch.title = owned ? skin.name : `${skin.name} — ${skin.cost} coins`;
      swatch.onclick = () => onPick(skin.id);
      this.shopRow.appendChild(swatch);
    }
  }

  showStartMenu(onStart: (count: number) => void): void {
    const best = this.getBestTime();
    this.startBest.textContent = best > 0 ? `Best so far: ${this.formatTime(best)}` : '';

    const choose = (count: number) => {
      window.removeEventListener('keydown', onKey);
      this.startScreen.classList.remove('visible');
      onStart(count);
    };
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= this.startButtons.length) {
        e.preventDefault();
        choose(n);
      }
    };

    for (const { el, count } of this.startButtons) {
      el.onclick = () => choose(count);
    }
    window.addEventListener('keydown', onKey);

    this.startScreen.classList.add('visible');
  }

  private formatTime(seconds: number): string {
    return `${Math.max(0, seconds).toFixed(1)}s`;
  }

  private getBestTime(): number {
    const raw = localStorage.getItem(UISystem.BEST_TIME_KEY);
    const value = raw ? parseFloat(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  private setBestTime(seconds: number): void {
    try {
      localStorage.setItem(UISystem.BEST_TIME_KEY, seconds.toFixed(2));
    } catch {
    }
  }

  private injectStyles(): void {
    if (document.getElementById('ekuke-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'ekuke-ui-styles';
    style.textContent = `
      .go-overlay {
        position: fixed; inset: 0; z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at 50% 35%, rgba(20,28,40,0.55), rgba(6,9,14,0.86));
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        opacity: 0; visibility: hidden; pointer-events: none;
        transition: opacity 0.28s ease, visibility 0.28s ease;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      .go-overlay.visible { opacity: 1; visibility: visible; pointer-events: auto; }

      .go-card {
        position: relative; width: min(90vw, 420px);
        padding: 36px 34px 30px; text-align: center;
        background: linear-gradient(180deg, rgba(31,40,56,0.96), rgba(17,22,32,0.96));
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 20px;
        box-shadow: 0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
        transform: translateY(14px) scale(0.97);
        transition: transform 0.32s cubic-bezier(0.18,0.9,0.3,1.2);
      }
      .go-overlay.visible .go-card { transform: translateY(0) scale(1); }
      .go-card::before {
        content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px;
        border-radius: 20px 20px 0 0; background: var(--go-accent, #ff5a4d);
      }
      .go-card.win  { --go-accent: #36d07b; }
      .go-card.lose { --go-accent: #ff5a4d; }

      .go-icon { font-size: 60px; line-height: 1; margin-bottom: 8px; }
      .go-title {
        margin: 0 0 6px; font-size: 38px; font-weight: 800; letter-spacing: 0.5px;
        color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.4);
      }
      .go-card.win  .go-title { color: #7ef0ad; }
      .go-card.lose .go-title { color: #ff8a80; }
      .go-sub { margin: 0 0 22px; font-size: 15px; color: #aeb6c4; }

      .go-stats { display: flex; gap: 12px; margin-bottom: 18px; }
      .go-stat {
        flex: 1; padding: 14px 10px; border-radius: 12px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
      }
      .go-stat-label {
        font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
        color: #8a93a6; margin-bottom: 6px;
      }
      .go-stat-value {
        font-size: 30px; font-weight: 700; color: #fff;
        font-family: 'Consolas', 'Courier New', monospace;
      }
      .go-stat-best { color: #ffd34e; }

      .go-record {
        display: none; margin: 0 auto 16px; width: fit-content;
        padding: 5px 14px; border-radius: 999px; font-size: 13px; font-weight: 700;
        color: #1b1402; background: linear-gradient(90deg, #ffe07a, #ffc23e);
        box-shadow: 0 4px 16px rgba(255,196,62,0.35);
        animation: go-pop 0.4s ease both;
      }
      @keyframes go-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }

      .go-btn {
        width: 100%; padding: 13px 0; font-size: 17px; font-weight: 700; color: #0c1018;
        border: none; border-radius: 12px; cursor: pointer;
        background: var(--go-accent, #ff5a4d);
        box-shadow: 0 8px 22px rgba(0,0,0,0.35);
        transition: transform 0.12s ease, filter 0.12s ease;
      }
      .go-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
      .go-btn:active { transform: translateY(0); filter: brightness(0.95); }
      .go-btn-secondary {
        margin-top: 8px; color: #cdd3dd; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.16); box-shadow: none;
      }
      .go-btn-secondary:hover { background: rgba(255,255,255,0.12); filter: none; }
      .go-hint { margin-top: 12px; font-size: 12px; color: #6c7589; }

      .sm-choices { display: flex; gap: 12px; margin: 6px 0 4px; }
      .sm-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
        padding: 16px 0; cursor: pointer; color: #fff;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px; transition: transform 0.1s ease, background 0.1s ease, border-color 0.1s ease;
      }
      .sm-btn:hover {
        transform: translateY(-2px);
        background: rgba(54,208,123,0.18); border-color: rgba(54,208,123,0.6);
      }
      .sm-btn:active { transform: translateY(0); }
      .sm-num { font-size: 30px; font-weight: 800; line-height: 1; }
      .sm-cap { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #aeb6c4; }

      .coin-counter {
        font-family: 'Consolas', 'Courier New', monospace; font-size: 20px; font-weight: 700;
        color: #ffd34e; text-shadow: 0 2px 6px rgba(0,0,0,0.5);
      }
      .go-coins { margin: -6px 0 10px; font-size: 15px; font-weight: 700; color: #ffd34e; }

      .shop-header {
        display: flex; justify-content: space-between; align-items: center;
        margin: 16px 0 8px; font-size: 12px; text-transform: uppercase;
        letter-spacing: 1.4px; color: #8a93a6;
      }
      .shop-coins { color: #ffd34e; font-weight: 700; font-family: 'Consolas', monospace; }
      .shop-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
      .shop-swatch {
        flex: 1 1 0; min-width: 52px; display: flex; flex-direction: column; align-items: center; gap: 5px;
        padding: 8px 4px; cursor: pointer; border-radius: 12px;
        background: rgba(255,255,255,0.04); border: 2px solid rgba(255,255,255,0.10);
        transition: transform 0.1s ease, border-color 0.1s ease, background 0.1s ease;
      }
      .shop-swatch:hover { transform: translateY(-2px); background: rgba(255,255,255,0.08); }
      .shop-swatch.selected { border-color: #ffd34e; background: rgba(255,211,78,0.12); }
      .shop-swatch.unaffordable { opacity: 0.5; }
      .shop-dot {
        width: 26px; height: 26px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.35); box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      }
      .shop-tag { font-size: 11px; font-weight: 700; color: #cdd3dd; white-space: nowrap; }
      .shop-swatch.selected .shop-tag { color: #ffd34e; }

      .auto-sprint-chip {
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 700;
        color: #c7ccd6; padding: 6px 12px; border-radius: 999px;
        background: rgba(20,24,32,0.55); border: 1px solid rgba(255,255,255,0.14);
        user-select: none; transition: all 0.12s ease; white-space: nowrap;
      }
      .auto-sprint-chip.on {
        color: #06210f; background: linear-gradient(90deg, #6ff0a6, #36d07b);
        border-color: rgba(54,208,123,0.8);
      }

      .danger-vignette {
        position: fixed; inset: 0; pointer-events: none; z-index: 90; opacity: 0;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(210,20,20,0.85) 100%);
        transition: opacity 0.1s linear;
      }
      .danger-vignette.pulse { animation: danger-pulse 0.6s ease-in-out infinite; }
      @keyframes danger-pulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.6); } }
      .danger-flash {
        position: fixed; inset: 0; pointer-events: none; z-index: 91; opacity: 0;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(255,70,70,0.95) 100%);
      }
      .danger-flash.on { animation: danger-flash-anim 0.4s ease-out; }
      @keyframes danger-flash-anim { 0% { opacity: 0.9; } 100% { opacity: 0; } }
    `;
    document.head.appendChild(style);
  }

  getContainer(): HTMLDivElement {
    return this.container;
  }
}
