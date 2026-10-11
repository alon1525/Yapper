'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The soundtrack, synthesised rather than loaded.
 *
 * One square-wave sting per slide, and nothing between them. There used to be
 * a constant four-oscillator drone under the whole deck; readers heard it as
 * "something is wrong with my computer", so it is gone. That is a few hundred bytes of code against a
 * few hundred kilobytes of audio on a product whose whole promise is that
 * nothing gets downloaded or uploaded — and it means the deck has a soundtrack
 * offline, on a plane, on a phone with no signal.
 *
 * Shared by the sample story on the landing page and the reader's own deck, so
 * the two sound identical. That matters more than it sounds: the landing page
 * is a promise about what the deck will be.
 */

export interface StorySound {
  enabled: boolean;
  toggle: () => void;
  /** Plays the sting for slide `index`. Silent while muted. */
  sting: (index: number, isFinale?: boolean) => void;
}

const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export function useStorySound(startEnabled = false): StorySound {
  const [enabled, setEnabled] = useState(startEnabled);

  /**
   * A ref, not the state, because `setState` lands on the next render: a
   * reader hammering the next-slide tap area advances twice in one tick, and
   * the second sting would read a stale `enabled`.
   */
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const acRef = useRef<AudioContext | null>(null);

  /**
   * Only ever called from inside a click handler — every browser refuses an
   * AudioContext that was not asked for, and one created outside a gesture
   * stays suspended forever with no error to tell you why.
   */
  const ctx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    acRef.current ??= new Ctor();
    if (acRef.current.state === 'suspended') void acRef.current.resume();
    return acRef.current;
  }, []);

  const sting = useCallback(
    (index: number, isFinale = false) => {
      if (!enabledRef.current) return;
      const ac = ctx();
      if (!ac) return;

      // The last slide resolves on a chord; every other one gets a single note,
      // walking the scale so consecutive slides never repeat a pitch.
      const notes = isFinale ? [523.25, 659.25, 783.99] : [SCALE[index % SCALE.length]!];

      notes.forEach((hz, k) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'square';
        osc.frequency.value = hz;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ac.destination);
        const t = ac.currentTime + k * 0.09;
        gain.gain.linearRampToValueAtTime(0.075, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    },
    [ctx],
  );

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      enabledRef.current = next;
      // Unmuting is a click, the one moment a browser lets the context start.
      if (next) ctx();
      return next;
    });
  }, [ctx]);

  /**
   * A tab in the background keeps its AudioContext running, and a sting
   * from a tab you are not looking at is "my computer is making a weird
   * noise". Suspended while hidden, resumed on return, but only if sound
   * is still on, because the reader may have muted it from here.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      const ac = acRef.current;
      if (!ac) return;
      if (document.hidden) void ac.suspend();
      else if (enabledRef.current) void ac.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(
    () => () => {
      void acRef.current?.close();
      acRef.current = null;
    },
    [],
  );

  // One object per `enabled` state rather than one per render. The deck plays
  // its sting from an effect keyed on this, and a fresh object every render
  // meant a note for every re-render — the report arriving, a save landing —
  // rather than for every slide.
  return useMemo(() => ({ enabled, toggle, sting }), [enabled, toggle, sting]);
}
