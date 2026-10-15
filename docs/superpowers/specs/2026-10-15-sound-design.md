# Sound — Design Spec

Date: 2026-10-15
Status: Approved in brainstorming, pending written-spec review

## Purpose

Give Retrato background music and interaction sounds with the woozy, hypnotic feel of a card-game soundtrack, while every note and sound stays original. Everything is **synthesised live with the Web Audio API**: there are no audio files, no licences and no new dependencies. Balatro's music and sound effects are copyrighted and are never used, sampled or transcribed; they're a mood reference only.

### Success criteria

1. A slow, dreamy, original music loop starts quietly on the guest's first tap or key press and keeps playing across screens, with a per-screen mix.
2. Button taps and key moments (reroll, pack opening, card flip, rare edition, shutter, print, confirm and error actions) each have their own short synthesised sound.
3. Guests can cycle **all on → effects only → all off** with a speaker button or the **M** key. The operator sets music and effects volumes, can hide the speaker button, and can play a test sound.
4. Audio never blocks or breaks the app: without Web Audio, or if the browser refuses to start it, the app runs silently with no errors and no speaker button.
5. Audio pauses while the tab is hidden and during the print dialog, rapid taps never pile up or clip, and the idle reset turns the guest's choice back to all on, so the operator's volumes apply to the next guest. An operator who wants a silent booth sets the music volume to 0.
6. Before merging, the user listens to recorded clips of the music and the key effects and approves them.

## Architecture

New folder `src/audio/` with no React inside it, plus one store and two small React hooks.

### `src/audio/engine.ts`

- `getEngine(): Engine | null` lazily creates one `AudioContext` (`window.AudioContext ?? window.webkitAudioContext`). It returns `null` when neither exists or the constructor throws, and every caller treats `null` as silent.
- Graph: `musicBus (GainNode) → master`, `sfxBus (GainNode) → master`, `master → DynamicsCompressor (threshold −10 dB, ratio 12, attack 3 ms, release 250 ms) → destination`.
- `unlock()` is called on the first `pointerdown` or `keydown` anywhere (a capture listener installed once by `useAudio`). It calls `ctx.resume()`, ignores rejections, then removes the listener. Nothing plays before unlock.
- `setLevels({ music, sfx })` takes values from 0 to 1 and ramps each bus gain with `setTargetAtTime(v, now, 0.05)`, so changes never click.
- `suspend()` and `resume()` wrap `ctx.suspend()`/`ctx.resume()` and swallow errors.
- A test seam, `__setEngineForTest(engine | null)`, lets tests inject a fake engine.

### `src/audio/sfx.ts`

- `type Sfx = 'tick' | 'hover' | 'reroll' | 'shake' | 'tear' | 'burst' | 'flip' | 'rare1' | 'rare2' | 'rare3' | 'shutter' | 'flash' | 'whirr' | 'chime' | 'confirm' | 'bonk'`.
- `play(name: Sfx, opts?: { at?: number })` returns a `Voice | null` handle with `stop()`. It returns `null` and makes no sound when the engine is missing or locked, effects are muted, the 6-voice cap is reached, or the same name was played less than 40 ms ago.
- Each recipe is a small function `(ctx, out, t0) => AudioNode[]` built from oscillators, a shared 1-second white-noise buffer, biquad filters and gain envelopes (attack, then exponential decay to 0.0001). It fits the pixel style: square and triangle waves with short envelopes.

| Sound | Recipe (approximate) | Length |
|---|---|---|
| `tick` | square 1200 Hz × random 0.92–1.08, gain 0.18, decay 40 ms | 45 ms |
| `hover` | triangle 2400 Hz, gain 0.06, decay 25 ms | 30 ms |
| `reroll` | 6 square blips rising C6→C7 by thirds, 30 ms apart, gain 0.12 | 200 ms |
| `shake` | band-passed noise (800 Hz, Q 4), 4 pulses 60 ms apart | 260 ms |
| `tear` | noise through a highpass sweeping 600→4000 Hz, gain 0.3 | 220 ms |
| `burst` | major-7 chord (C5 E5 G5 B5), triangle, staggered 15 ms, sparkle tail of 3 random high square blips | 700 ms |
| `flip` | noise whoosh (lowpass 3000→800 Hz) and a low triangle "thup" at 140 Hz | 250 ms |
| `rare1` / `rare2` / `rare3` | rising arpeggio of 3 / 4 / 6 notes (C5 E5 G5 C6 E6 G6), square, 70 ms apart (Foil / Holo / Poly) | ≤ 500 ms |
| `shutter` | two noise clicks 70 ms apart (highpass 2000 Hz) and a sine thump at 90 Hz | 150 ms |
| `flash` | sine sweep 3000→300 Hz with a noise sizzle | 300 ms |
| `whirr` | sawtooth 70 Hz, lowpass 500 Hz, 20 Hz tremolo, fade in and out | 900 ms |
| `chime` | two triangle notes G5→C6, 120 ms apart, long decay | 600 ms |
| `confirm` | square E6→B6, 60 ms apart | 150 ms |
| `bonk` | square D3→A2, 90 ms apart, lowpass 1200 Hz | 250 ms |

### `src/audio/music.ts`

- Original 8-bar loop at **80 BPM** in D minor: **Dm9 | Dm9 | B♭maj7 | B♭maj7 | Gm9 | Gm9 | A7sus4 | A7**.
- Voices:
  - **Pads:** 2 detuned sawtooths per chord tone (±7 cents), lowpass 1400 Hz, with slow attack and release (0.8 s / 1.2 s).
  - **Wobble:** a shared 0.25 Hz sine LFO modulates the pad pitch by ±12 cents, which gives the woozy feel.
  - **Bass:** triangle wave on the chord root, on beats 1 and 3, with soft pulses.
  - **Melody:** a sparse square-wave lead at gain 0.05. Each beat has a 35 % chance of playing a note from the D minor pentatonic in octave 5, drawn from an injectable `rand`, so each pass differs slightly.
- Scheduler: a standard look-ahead loop. A `setInterval` of 25 ms schedules every note that starts within the next 120 ms, using `ctx.currentTime`. Each bar's start is `loopStart + bar × barSeconds`, computed from the bar index rather than accumulated, so the loop never drifts.
- `startMusic()` fades the music bus in from 0 over 2 s, and `stopMusic()` fades it out over 0.5 s and clears the interval. Both are idempotent.
- `setMix('full' | 'quiet' | 'duck')`:
  - `full`: music multiplier 1, lowpass open;
  - `quiet`: multiplier 0.55, with a lowpass on the music bus at 900 Hz;
  - `duck`: multiplier 0.3, recovering to the screen's mix after 1.2 s.
- Screen mix: the shop is `full`; the booth, editor, pack and tray are `quiet`. The pack opening's `tear` ducks the music.

### `src/store/sound.ts` (Zustand)

- Guest state: `mode: 'all' | 'sfx' | 'off'`, plus `cycle()` (all → sfx → off → all) and `resetToDefault()`. The default is `'all'`, saved under `retrato:sound` via `readJson`/`writeJson`. Invalid saved values fall back to the default.
- Operator settings live in the existing `retrato:operator` store (`src/store/operator.ts`): `musicVolume` (0–100, default 40), `sfxVolume` (0–100, default 70) and `showSoundButton` (default true). Each has a loader that defaults safely like `loadIdleMinutes`, is included in `save()`, and is reset by `reset()`.
- Effective levels: `music = mode === 'all' ? musicVolume / 100 : 0` and `sfx = mode === 'off' ? 0 : sfxVolume / 100`.

### React wiring

- `src/audio/useAudio.ts` is mounted once in `App`. It:
  - installs the unlock listener;
  - pushes effective levels to the engine whenever they change;
  - starts the music after unlock when music is above 0, and stops it when music is 0;
  - sets the mix from the current screen (and from the tray when it's open);
  - suspends the engine on `visibilitychange` to hidden and resumes on visible;
  - suspends around `beforeprint`/`afterprint`.
- `src/audio/useTapSounds.ts` is also mounted in `App`. One capture `pointerdown` listener on `document` plays `tick` when the target is inside an enabled `button`, `select`, `summary`, `[role="button"]` or `.tile-btn`. Buttons that play their own sound (those marked `data-sfx`) are skipped. On devices with a fine pointer only, a `pointerover` listener plays `hover` when entering `.tile-btn` or `.pack-btn`.
- Explicit calls (each marks its button `data-sfx` where it's a button):
  - **Shop:** Reroll plays `reroll`.
  - **Pack opening** (`usePackOpen`): entering `shake` plays `shake`, `tear` plays `tear` and ducks the music, and `burst` plays `burst`. Skipping to `done` stops any pending voices.
  - **Card reveal** (`useReveal`): entering `flip` plays `flip`. When `celebrate` turns true, it plays `rare1`/`rare2`/`rare3` depending on the edition: foil, holo, poly.
  - **Booth capture:** `shutter`, then `flash` with the flash phase of `usePrintSequence`; `eject` plays `whirr` and `handoff` plays `chime`. A skip stops the whirr.
  - **Editor:** Download and Add to tray play `confirm`, and Print plays `confirm`. A full tray, a blocked action or a camera error plays `bonk`.
  - **Operator panel:** Test sound plays `chime`.
- **Speaker button** `src/ui/SoundButton.tsx`:
  - Shown in the header next to the tray button when `showSoundButton` is true and the engine exists.
  - Three states with pixel speaker glyphs (speaker with waves, speaker with a single note, speaker with an X), drawn in CSS or inline SVG, never emoji.
  - `aria-label` is "Sound: all on", "Sound: effects only" or "Sound: off"; `aria-pressed` is not used, since the button has three states.
  - The **M** key cycles the state, unless focus is in an `input`, `textarea` or `select`, or the operator panel is open. Ctrl, Cmd and Alt combinations are ignored.
- **Operator panel:** a "Sound" group with a music volume slider, an effects volume slider, a "Show speaker button to guests" checkbox and a "Test sound" button.
- **Idle reset:** also calls `useSound.getState().resetToDefault()`.

## Error handling

- Missing Web Audio or a refused `AudioContext` constructor: `getEngine()` returns `null`, every `play`, `startMusic` and `setLevels` call does nothing, and the speaker button is hidden.
- `resume()` or `suspend()` rejections are caught and ignored, and the next gesture tries to unlock again.
- Corrupt saved settings fall back to the defaults.
- The scheduler stops when the engine is suspended and catches up without bursts: notes whose start time has passed are skipped, never played late.

## Testing

**Unit (fake AudioContext in `src/audio/fakeAudio.ts`, test-only, recording created nodes and scheduled param changes):**
- `engine`:
  - returns `null` without AudioContext;
  - unlocks on the first gesture only;
  - `setLevels` ramps both buses;
  - the compressor is in the chain.
- `sfx`:
  - every name in `Sfx` creates nodes and stops them at its length;
  - nothing plays when locked or muted;
  - the 40 ms same-name guard holds;
  - the 6-voice cap holds;
  - `tick` pitch stays within ±8 %;
  - `stop()` silences a voice.
- `music`:
  - the chord roots per bar match the progression;
  - bar times are computed from the index, so 100 loops show no drift;
  - only notes within the look-ahead window are scheduled;
  - start and stop are idempotent;
  - `setMix` values match;
  - melody density uses the injected `rand`.
- `store/sound` and operator: defaults, cycling, persistence, invalid saved values, and loading operator settings saved before this feature (no sound keys).

**Component:**
- `SoundButton` cycles labels on click and on M; M is ignored in inputs and with modifiers; the button is hidden when the operator turns it off or there's no engine.
- `useTapSounds`: a tap on a button plays `tick`; a `data-sfx` button does not; disabled buttons don't play.
- Pack and reveal hooks play their sounds at the right steps, and skipping stops pending voices.
- Operator panel: the sliders and checkbox save their values; Test sound plays `chime`.
- Idle reset restores the sound mode.

**Manual:** headless Chrome records the music (about 30 s) and each effect to WAV through an `OfflineAudioContext` render of the same recipes. They're published on an Artifact page for the user to listen to and approve before merging.

## Out of scope

User-uploaded music, a music editor, haptics or vibration, per-screen music tracks, and spatial audio.
