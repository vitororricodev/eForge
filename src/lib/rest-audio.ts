/** Repeated, bright tones for the end of a rest, with headroom to avoid clipping. */
export function scheduleRestAlert(context: BaseAudioContext) {
  const nodes: { oscillator: OscillatorNode; gain: GainNode }[] = [];
  const start = context.currentTime + 0.015;

  for (let index = 0; index < 6; index++) {
    const onset = start + index * 0.32;
    const end = onset + (index === 5 ? 0.38 : 0.22);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(index % 2 === 0 ? 1000 : 1400, onset);
    gain.gain.setValueAtTime(0, onset);
    gain.gain.linearRampToValueAtTime(0.95, onset + 0.008);
    gain.gain.setValueAtTime(0.95, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(onset);
    oscillator.stop(end);
    nodes.push({ oscillator, gain });
  }

  return () => {
    for (const { oscillator, gain } of nodes) {
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
  };
}

/** Owned by the workout screen; enabling it prepares audio inside the user's tap. */
export function createRestAudio() {
  let context: AudioContext | null = null;
  let enabled = false;
  let disposed = false;
  let request = 0;
  let cancel: (() => void) | null = null;

  function stop() {
    request++;
    cancel?.();
    cancel = null;
  }

  function setEnabled(value: boolean) {
    if (disposed) return;
    enabled = value;
    if (!value) {
      stop();
      return;
    }
    try {
      const Audio =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      if (context.state !== "running" && context.state !== "closed")
        void context.resume().catch(() => {});
    } catch {
      // Vibration and the timer remain available when the device blocks audio.
    }
  }

  function play() {
    if (!enabled || disposed || !context) return;
    stop();
    const currentRequest = request;
    const requestedAt = Date.now();
    const audio = context;
    const start = () => {
      if (
        !enabled ||
        disposed ||
        currentRequest !== request ||
        audio.state !== "running" ||
        Date.now() - requestedAt > 1000
      )
        return;
      try {
        cancel = scheduleRestAlert(audio);
      } catch {
        // An interrupted audio context must not interfere with the workout.
      }
    };
    if (audio.state === "running") start();
    else if (audio.state !== "closed")
      void audio
        .resume()
        .then(start)
        .catch(() => {});
  }

  function dispose() {
    disposed = true;
    enabled = false;
    stop();
    if (context && context.state !== "closed") void context.close().catch(() => {});
    context = null;
  }

  return { setEnabled, play, stop, dispose };
}
