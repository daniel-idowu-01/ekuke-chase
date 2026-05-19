import { UI } from '../utils/Constants';


export class UISystem {
  private container: HTMLDivElement;
  private playerHealthBar: HTMLElement;
  private playerHealthText: HTMLElement;
  private enemyHealthBar: HTMLElement;
  private enemyHealthText: HTMLElement;
  private timerText: HTMLElement;
  private objectiveText: HTMLElement;
  private fpsCounter: HTMLElement;
  private gameOverScreen: HTMLElement;
  private fpsFrameCount: number = 0;
  private fpsDeltaTime: number = 0;

  constructor() {
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

    this.playerHealthBar = this.createHealthBar('player-health', true);

    this.playerHealthText = document.createElement('div');
    this.playerHealthText.style.position = 'absolute';
    this.playerHealthText.style.top = `${UI.PADDING + 50}px`;
    this.playerHealthText.style.left = `${UI.PADDING}px`;
    this.playerHealthText.style.color = '#ffffff';
    this.playerHealthText.style.fontSize = `${UI.FONT_SIZE}px`;
    this.playerHealthText.textContent = 'Player HP: 100/100';
    this.container.appendChild(this.playerHealthText);

    this.enemyHealthBar = this.createHealthBar('enemy-health', false);

    this.enemyHealthText = document.createElement('div');
    this.enemyHealthText.style.position = 'absolute';
    this.enemyHealthText.style.top = `${UI.PADDING + 50}px`;
    this.enemyHealthText.style.right = `${UI.PADDING}px`;
    this.enemyHealthText.style.color = '#ffffff';
    this.enemyHealthText.style.fontSize = `${UI.FONT_SIZE}px`;
    this.enemyHealthText.textContent = 'Enemy HP: 60/60';
    this.container.appendChild(this.enemyHealthText);

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
    screen.style.position = 'fixed';
    screen.style.top = '0';
    screen.style.left = '0';
    screen.style.width = '100%';
    screen.style.height = '100%';
    screen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    screen.style.display = 'none';
    screen.style.flexDirection = 'column';
    screen.style.justifyContent = 'center';
    screen.style.alignItems = 'center';
    screen.style.zIndex = '1000';

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.color = '#ff0000';
    title.style.fontSize = '72px';
    title.style.marginBottom = '20px';

    const message = document.createElement('p');
    message.id = 'game-over-message';
    message.textContent = '';
    message.style.color = '#ffffff';
    message.style.fontSize = '24px';
    message.style.marginBottom = '40px';

    const restartButton = document.createElement('button');
    restartButton.textContent = 'Restart';
    restartButton.style.padding = '10px 30px';
    restartButton.style.fontSize = '20px';
    restartButton.style.backgroundColor = '#00ff00';
    restartButton.style.border = 'none';
    restartButton.style.borderRadius = '4px';
    restartButton.style.cursor = 'pointer';
    restartButton.style.fontWeight = 'bold';

    screen.appendChild(title);
    screen.appendChild(message);
    screen.appendChild(restartButton);

    this.container.appendChild(screen);
    return screen;
  }

  updatePlayerHealth(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    const fill = this.playerHealthBar.querySelector('.health-fill') as HTMLElement;
    if (fill) {
      fill.style.width = `${ratio * 100}%`;
    }
    this.playerHealthText.textContent = `Player HP: ${Math.ceil(current)}/${max}`;
  }

  updateEnemyHealth(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    const fill = this.enemyHealthBar.querySelector('.health-fill') as HTMLElement;
    if (fill) {
      fill.style.width = `${ratio * 100}%`;
    }
    this.enemyHealthText.textContent = `Enemy HP: ${Math.ceil(current)}/${max}`;
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

  showGameOver(playerWon: boolean, onRestart: () => void): void {
    const screen = this.gameOverScreen;
    const title = screen.querySelector('h1') as HTMLElement;
    const message = screen.querySelector('#game-over-message') as HTMLElement;
    const button = screen.querySelector('button') as HTMLElement;

    if (playerWon) {
      title.textContent = 'SURVIVED';
      message.textContent = 'You escaped the dog.';
      message.style.color = '#00ff00';
    } else {
      title.textContent = 'CAUGHT';
      message.textContent = 'The dog caught you.';
      message.style.color = '#ff0000';
    }

    screen.style.display = 'flex';

    button.onclick = () => {
      screen.style.display = 'none';
      onRestart();
    };
  }

  hideGameOver(): void {
    this.gameOverScreen.style.display = 'none';
  }

  getContainer(): HTMLDivElement {
    return this.container;
  }
}
