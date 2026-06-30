type TouchRole = 'joy' | 'sprint' | 'jump' | 'free';

interface TrackedTouch {
  role: TouchRole;
  x: number;
  y: number;
}

/**
 * On-screen touch controls for phones/tablets. Stays hidden until the first
 * touch, so desktop (mouse/keyboard) is never affected. Input is read by the
 * game loop each frame via the getters; nothing here touches game state
 * directly. Layout: dynamic left-thumb joystick + right-thumb sprint/jump
 * buttons. Two free fingers = pinch-to-zoom. Camera auto-follows, so there's
 * no manual look control.
 */
export class TouchControls {
  private root: HTMLDivElement;
  // Assigned inside buildDom(), called from the constructor.
  private joyBase!: HTMLDivElement;
  private joyKnob!: HTMLDivElement;
  private sprintBtn!: HTMLDivElement;
  private jumpBtn!: HTMLDivElement;

  private active = false;
  private moveX = 0;
  private moveForward = 0;
  private jumpQueued = false;
  private pinchDelta = 0;

  private readonly maxRadius = 56;
  private readonly deadzone = 8;

  private touches = new Map<number, TrackedTouch>();
  private joyId: number | null = null;
  private joyOriginX = 0;
  private joyOriginY = 0;
  private lastPinchDist: number | null = null;

  constructor() {
    this.injectStyles();
    this.root = this.buildDom();
    document.body.appendChild(this.root);

    document.addEventListener('touchstart', this.onTouchStart, { passive: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  // ---- public read API (polled by GameManager each frame) ----

  isActive(): boolean {
    return this.active;
  }

  getMove(): { x: number; forward: number } {
    return { x: this.moveX, forward: this.moveForward };
  }

  isSprinting(): boolean {
    for (const t of this.touches.values()) {
      if (t.role === 'sprint') return true;
    }
    return false;
  }

  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  consumePinch(): number {
    const delta = this.pinchDelta;
    this.pinchDelta = 0;
    return delta;
  }

  // ---- touch handling ----

  private onTouchStart = (e: TouchEvent): void => {
    this.reveal();
    for (const t of Array.from(e.changedTouches)) {
      // Let touches on the game-over screen behave normally (button taps).
      if ((t.target as HTMLElement | null)?.closest('.go-overlay')) continue;

      const role = this.classify(t.clientX, t.clientY);
      this.touches.set(t.identifier, { role, x: t.clientX, y: t.clientY });

      if (role === 'joy') {
        this.joyId = t.identifier;
        this.joyOriginX = t.clientX;
        this.joyOriginY = t.clientY;
        this.showJoystick(t.clientX, t.clientY);
      } else if (role === 'sprint') {
        this.sprintBtn.classList.add('pressed');
      } else if (role === 'jump') {
        this.jumpQueued = true;
        this.jumpBtn.classList.add('pressed');
      }
    }
    this.updatePinch();
  };

  private onTouchMove = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      const tracked = this.touches.get(t.identifier);
      if (!tracked) continue;
      tracked.x = t.clientX;
      tracked.y = t.clientY;
      if (t.identifier === this.joyId) {
        this.updateJoystick(t.clientX, t.clientY);
      }
    }
    this.updatePinch();
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      const tracked = this.touches.get(t.identifier);
      if (!tracked) continue;
      this.touches.delete(t.identifier);

      if (t.identifier === this.joyId) {
        this.joyId = null;
        this.moveX = 0;
        this.moveForward = 0;
        this.hideJoystick();
      }
    }
    if (!this.isSprinting()) this.sprintBtn.classList.remove('pressed');
    this.jumpBtn.classList.remove('pressed');
    this.updatePinch();
  };

  private classify(x: number, y: number): TouchRole {
    if (this.hitButton(this.sprintBtn, x, y)) return 'sprint';
    if (this.hitButton(this.jumpBtn, x, y)) return 'jump';
    if (this.joyId === null && x < window.innerWidth * 0.5) return 'joy';
    return 'free';
  }

  private hitButton(el: HTMLElement, x: number, y: number): boolean {
    const r = el.getBoundingClientRect();
    const pad = 14;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  }

  private updateJoystick(x: number, y: number): void {
    const dx = x - this.joyOriginX;
    const dy = y - this.joyOriginY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    this.joyKnob.style.left = `${this.joyOriginX + kx}px`;
    this.joyKnob.style.top = `${this.joyOriginY + ky}px`;

    if (dist < this.deadzone) {
      this.moveX = 0;
      this.moveForward = 0;
    } else {
      this.moveX = kx / this.maxRadius;
      this.moveForward = -ky / this.maxRadius; // up on screen = forward
    }
  }

  private updatePinch(): void {
    const free: TrackedTouch[] = [];
    for (const t of this.touches.values()) {
      if (t.role === 'free') free.push(t);
    }
    if (free.length >= 2) {
      const d = Math.hypot(free[0].x - free[1].x, free[0].y - free[1].y);
      if (this.lastPinchDist !== null) {
        // Fingers apart -> zoom in (negative); together -> zoom out (positive).
        this.pinchDelta += -(d - this.lastPinchDist) * 0.012;
      }
      this.lastPinchDist = d;
    } else {
      this.lastPinchDist = null;
    }
  }

  private reveal(): void {
    if (this.active) return;
    this.active = true;
    this.root.style.display = 'block';
  }

  private showJoystick(x: number, y: number): void {
    this.joyBase.style.left = `${x}px`;
    this.joyBase.style.top = `${y}px`;
    this.joyKnob.style.left = `${x}px`;
    this.joyKnob.style.top = `${y}px`;
    this.joyBase.classList.add('on');
    this.joyKnob.classList.add('on');
  }

  private hideJoystick(): void {
    this.joyBase.classList.remove('on');
    this.joyKnob.classList.remove('on');
  }

  // ---- DOM / styles ----

  private buildDom(): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'touch-controls';

    this.joyBase = document.createElement('div');
    this.joyBase.className = 'tc-joy-base';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'tc-joy-knob';

    this.sprintBtn = document.createElement('div');
    this.sprintBtn.className = 'tc-btn tc-sprint';
    this.sprintBtn.textContent = 'DASH';

    this.jumpBtn = document.createElement('div');
    this.jumpBtn.className = 'tc-btn tc-jump';
    this.jumpBtn.textContent = 'JUMP';

    root.appendChild(this.joyBase);
    root.appendChild(this.joyKnob);
    root.appendChild(this.sprintBtn);
    root.appendChild(this.jumpBtn);
    return root;
  }

  private injectStyles(): void {
    if (document.getElementById('touch-controls-styles')) return;
    const style = document.createElement('style');
    style.id = 'touch-controls-styles';
    style.textContent = `
      #touch-controls {
        position: fixed; inset: 0; z-index: 500;
        pointer-events: none; display: none;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      .tc-joy-base {
        position: absolute; width: 120px; height: 120px; border-radius: 50%;
        background: rgba(255,255,255,0.07); border: 2px solid rgba(255,255,255,0.22);
        transform: translate(-50%,-50%); opacity: 0; transition: opacity 0.12s ease;
      }
      .tc-joy-knob {
        position: absolute; width: 54px; height: 54px; border-radius: 50%;
        background: rgba(255,255,255,0.82); box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        transform: translate(-50%,-50%); opacity: 0; transition: opacity 0.12s ease;
      }
      .tc-joy-base.on, .tc-joy-knob.on { opacity: 1; }
      .tc-btn {
        position: absolute; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 14px; letter-spacing: 1px; color: #fff;
        border: 2px solid rgba(255,255,255,0.4);
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        transition: transform 0.08s ease, filter 0.08s ease;
      }
      .tc-btn.pressed { transform: scale(0.9); filter: brightness(1.35); }
      .tc-jump {
        right: 30px; bottom: 42px; width: 92px; height: 92px;
        background: rgba(54,208,123,0.34);
      }
      .tc-sprint {
        right: 132px; bottom: 84px; width: 78px; height: 78px; font-size: 13px;
        background: rgba(80,150,255,0.34);
      }
    `;
    document.head.appendChild(style);
  }
}
