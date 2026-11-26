import {
  PLAYER_BOUNDS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type PlayerInput,
} from '@fighterjet/shared';

const MOVEMENT_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export class InputController {
  private canvas: HTMLCanvasElement | null = null;
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private touchTarget: { x: number; y: number } | null = null;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown, {
      passive: false,
    });
    canvas.addEventListener('pointermove', this.onPointerMove, {
      passive: false,
    });
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    const canvas = this.canvas;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerUp);
    }

    this.canvas = null;
  }

  getInput(): PlayerInput {
    if (this.touchTarget) {
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        targetX: this.touchTarget.x,
        targetY: this.touchTarget.y,
      };
    }

    return {
      up: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      down: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
    };
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!MOVEMENT_CODES.has(event.code)) {
      return;
    }
    event.preventDefault();
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.pointerId = null;
    this.touchTarget = null;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.canvas?.setPointerCapture(event.pointerId);
    this.updateTouchTarget(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    this.updateTouchTarget(event);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return;
    }
    this.pointerId = null;
    this.touchTarget = null;
  };

  private updateTouchTarget(event: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT;

    this.touchTarget = {
      x: Math.min(PLAYER_BOUNDS.maxX, Math.max(PLAYER_BOUNDS.minX, x)),
      y: Math.min(
        PLAYER_BOUNDS.maxY,
        Math.max(PLAYER_BOUNDS.minY, y - 40),
      ),
    };
  }
}
