import type { GameEvent } from '@fighterjet/shared';

export type SfxName =
  | 'shoot'
  | 'hit'
  | 'explosion'
  | 'pickup'
  | 'death'
  | 'boss';

const EVENT_SOUND: Partial<Record<GameEvent['type'], SfxName>> = {
  'player-shot': 'shoot',
  'enemy-hit': 'hit',
  'enemy-killed': 'explosion',
  'player-died': 'death',
  'game-over': 'death',
  pickup: 'pickup',
  'boss-warning': 'boss',
};

export class SfxPlayer {
  private context: AudioContext | null = null;

  unlock(): void {
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ??
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      this.context = new AudioContextClass();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  playEvents(events: GameEvent[]): void {
    const seen = new Set<SfxName>();

    for (const event of events) {
      const sound = EVENT_SOUND[event.type];
      if (!sound || seen.has(sound)) {
        continue;
      }
      seen.add(sound);
      this.play(sound);
    }
  }

  play(name: SfxName): void {
    const context = this.context;
    if (!context) {
      return;
    }

    const now = context.currentTime;

    if (name === 'explosion') {
      this.playNoise(context, now, 0.14, 0.22);
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);

    const settings: Record<
      Exclude<SfxName, 'explosion'>,
      { type: OscillatorType; from: number; to: number; duration: number; volume: number }
    > = {
      shoot: {
        type: 'square',
        from: 880,
        to: 520,
        duration: 0.035,
        volume: 0.04,
      },
      hit: {
        type: 'square',
        from: 260,
        to: 180,
        duration: 0.05,
        volume: 0.05,
      },
      pickup: {
        type: 'triangle',
        from: 660,
        to: 990,
        duration: 0.12,
        volume: 0.06,
      },
      death: {
        type: 'sawtooth',
        from: 180,
        to: 50,
        duration: 0.4,
        volume: 0.08,
      },
      boss: {
        type: 'sawtooth',
        from: 90,
        to: 60,
        duration: 0.5,
        volume: 0.08,
      },
    };

    const setting = settings[name];
    oscillator.type = setting.type;
    oscillator.frequency.setValueAtTime(setting.from, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      setting.to,
      now + setting.duration,
    );
    gain.gain.setValueAtTime(setting.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + setting.duration);
    oscillator.start(now);
    oscillator.stop(now + setting.duration);
  }

  private playNoise(
    context: AudioContext,
    now: number,
    duration: number,
    volume: number,
  ): void {
    const frameCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index++) {
      const fade = 1 - index / frameCount;
      data[index] = (Math.random() * 2 - 1) * fade;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(now);
  }
}
