/**
 * Live Bluetooth / USB Gamepad manager for Open Emulator.
 * Detects connected controllers on Android (Lenovo Tab 11) and Desktop,
 * drives menu navigation while in the Library, and pauses automatically
 * while a game is running so EmulatorJS owns all gamepad input.
 */

const BUTTON_NAMES = [
  'A / Cruz', 'B / Círculo', 'X / Cuadrado', 'Y / Triángulo',
  'L1 / LB', 'R1 / RB', 'L2 / LT', 'R2 / RT',
  'Select / Back', 'Start / Menu', 'L3', 'R3',
  'D-Pad Arriba', 'D-Pad Abajo', 'D-Pad Izquierda', 'D-Pad Derecha',
  'Home'
];

export class GamepadManager {
  constructor({ onStatusChange, onAction, onTesterUpdate }) {
    this.onStatusChange = onStatusChange || (() => {});
    this.onAction = onAction || (() => {});
    this.onTesterUpdate = onTesterUpdate || (() => {});

    this.paused = false;
    this.testerEnabled = false;
    this.rafId = null;
    this.lastActionTime = 0;
    this.prevButtons = new Map();
    this.connectedNames = [];

    this._onConnect = () => this._refreshConnected();
    this._onDisconnect = () => this._refreshConnected();
  }

  start() {
    window.addEventListener('gamepadconnected', this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
    this._refreshConnected();
    this._loop();
  }

  stop() {
    window.removeEventListener('gamepadconnected', this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  setPaused(isPaused) {
    this.paused = isPaused;
  }

  setTesterEnabled(enabled) {
    this.testerEnabled = enabled;
  }

  _getPads() {
    if (!navigator.getGamepads) return [];
    return Array.from(navigator.getGamepads()).filter(Boolean);
  }

  _refreshConnected() {
    const pads = this._getPads();
    const names = pads.map((p) => p.id.replace(/\s*\(STANDARD GAMEPAD.*?\)/i, '').trim());
    const changed = JSON.stringify(names) !== JSON.stringify(this.connectedNames);
    this.connectedNames = names;
    if (changed) {
      this.onStatusChange(names);
    }
  }

  _loop() {
    this._refreshConnected();
    const pads = this._getPads();

    if (pads.length > 0) {
      const pad = pads[0];

      if (this.testerEnabled) {
        const activeButtons = [];
        pad.buttons.forEach((btn, idx) => {
          if (btn.pressed || btn.value > 0.5) {
            activeButtons.push(BUTTON_NAMES[idx] || `Botón ${idx}`);
          }
        });
        const axes = (pad.axes || []).slice(0, 4).map((v) => Number(v.toFixed(2)));
        this.onTesterUpdate({
          name: this.connectedNames[0] || pad.id,
          activeButtons,
          axes
        });
      }

      if (!this.paused) {
        this._handleMenuNavigation(pad);
      }
    } else if (this.testerEnabled) {
      this.onTesterUpdate(null);
    }

    this.rafId = requestAnimationFrame(() => this._loop());
  }

  _isJustPressed(pad, idx) {
    const curr = Boolean(pad.buttons[idx]?.pressed);
    const prev = Boolean(this.prevButtons.get(idx));
    this.prevButtons.set(idx, curr);
    return curr && !prev;
  }

  _handleMenuNavigation(pad) {
    const now = performance.now();

    // Face buttons (instant edge-triggered)
    if (this._isJustPressed(pad, 0)) {
      this.onAction('confirm');
      return;
    }
    if (this._isJustPressed(pad, 1)) {
      this.onAction('back');
      return;
    }
    if (this._isJustPressed(pad, 4)) {
      this.onAction('prevTab');
      return;
    }
    if (this._isJustPressed(pad, 5)) {
      this.onAction('nextTab');
      return;
    }

    // Directional navigation (debounced)
    const up = pad.buttons[12]?.pressed || (pad.axes[1] || 0) < -0.55;
    const down = pad.buttons[13]?.pressed || (pad.axes[1] || 0) > 0.55;
    const left = pad.buttons[14]?.pressed || (pad.axes[0] || 0) < -0.55;
    const right = pad.buttons[15]?.pressed || (pad.axes[0] || 0) > 0.55;

    if ((up || down || left || right) && now - this.lastActionTime > 190) {
      this.lastActionTime = now;
      if (up) this.onAction('up');
      else if (down) this.onAction('down');
      else if (left) this.onAction('left');
      else if (right) this.onAction('right');
    }
  }
}
