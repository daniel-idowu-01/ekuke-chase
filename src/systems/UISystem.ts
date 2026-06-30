import { UI } from '../utils/Constants';


export class UISystem {
  private container: HTMLDivElement;
  private staminaBar: HTMLElement;
  private staminaText: HTMLElement;
  private timerText: HTMLElement;
  private objectiveText: HTMLElement;
  private fpsCounter: HTMLElement;
  private gameOverScreen: HTMLElement;
  // Assigned inside createGameOverScreen(), called from the constructor.
  private goCard!: HTMLElement;
  private goIcon!: HTMLElement;
  private goTitle!: HTMLElement;
  private goSub!: HTMLElement;
  private goTimeValue!: HTMLElement;
  private goBestValue!: HTMLElement;
  private goRecord!: HTMLElement;
  private goButton!: HTMLButtonElement;
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

    this.timerText = document.createElement('div');
    this.timerText.style.position = 'absolute';
    this.timerText.style.top = `${UI.PADDING}px`;
    this.timerText.style.left = '50%';
    this.timerText.style.transform = 'translateX(-50%)';
    this.timerText.style.color = '#ffffff';
    this.timerText.style.fontSize = '28px';
    this.timerText.style.fontWeight = 'bold';
    this.timerText.textContent = '60';
    this.container.appendChild(this.timerText);

    this.objectiveText = document.createElement('div');
    this.objectiveText.style.position = 'absolute';
    this.objectiveText.style.top = `${UI.PADDING + 40}px`;
    this.objectiveText.style.left = '50%';
    this.objectiveText.style.transform = 'translateX(-50%)';
    this.objectiveText.style.color = '#ffffff';
    this.objectiveText.style.fontSize = `${UI.FONT_SIZE}px`;
    this.objectiveText.textContent = 'Survive until the timer reaches zero';
    this.container.appendChild(this.objectiveText);

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

    // Stats row: time survived (primary) + best time.
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

    const record = document.createElement('div');
    record.className = 'go-record';
    record.textContent = '★ New best time!';

    const button = document.createElement('button');
    button.className = 'go-btn';
    button.textContent = 'Play again';

    const hint = document.createElement('div');
    hint.className = 'go-hint';
    hint.textContent = 'Press Enter';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(stats);
    card.appendChild(record);
    card.appendChild(button);
    card.appendChild(hint);
    screen.appendChild(card);
    this.container.appendChild(screen);

    this.goCard = card;
    this.goIcon = icon;
    this.goTitle = title;
    this.goSub = sub;
    this.goTimeValue = timeValue;
    this.goBestValue = bestValue;
    this.goRecord = record;
    this.goButton = button;

    return screen;
  }

  updateStamina(ratio: number, exhausted: boolean): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const fill = this.staminaBar.querySelector('.health-fill') as HTMLElement;
    if (fill) {
      fill.style.width = `${clamped * 100}%`;
      // Exhausted: red. Low but recovering: amber. Otherwise green.
      fill.style.backgroundColor = exhausted
        ? '#ff3b30'
        : clamped < 0.35
          ? '#ffb300'
          : '#00d26a';
    }
    this.staminaText.textContent = exhausted ? 'Exhausted!' : 'Stamina';
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

  updateSurvivalTimer(timeRemaining: number): void {
    this.timerText.textContent = `${Math.ceil(Math.max(0, timeRemaining))}`;
  }

  showGameOver(playerWon: boolean, survivedSeconds: number, onRestart: () => void): void {
    const best = this.getBestTime();
    const isRecord = survivedSeconds > best + 0.05;
    if (isRecord) {
      this.setBestTime(survivedSeconds);
    }
    const bestToShow = Math.max(best, survivedSeconds);

    this.goCard.classList.toggle('win', playerWon);
    this.goCard.classList.toggle('lose', !playerWon);
    this.goIcon.textContent = playerWon ? '🏆' : '🐾';
    this.goTitle.textContent = playerWon ? 'You Survived!' : 'Caught!';
    this.goSub.textContent = playerWon
      ? 'You outran the dog for the full minute.'
      : 'The dog ran you down. Keep moving next time.';
    this.goTimeValue.textContent = this.formatTime(survivedSeconds);
    this.goBestValue.textContent = this.formatTime(bestToShow);
    this.goRecord.style.display = isRecord ? 'block' : 'none';

    this.gameOverScreen.classList.add('visible');

    const restart = () => {
      window.removeEventListener('keydown', onKey);
      this.hideGameOver();
      onRestart();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        restart();
      }
    };
    this.goButton.onclick = restart;
    window.addEventListener('keydown', onKey);
  }

  hideGameOver(): void {
    this.gameOverScreen.classList.remove('visible');
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
      // Ignore storage being unavailable (private mode, etc.).
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
      .go-hint { margin-top: 12px; font-size: 12px; color: #6c7589; }
    `;
    document.head.appendChild(style);
  }

  getContainer(): HTMLDivElement {
    return this.container;
  }
}
