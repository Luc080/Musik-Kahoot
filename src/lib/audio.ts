/** Winzige stille WAV-Datei – zum "Freischalten" von Audio per Klick */
export const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

/**
 * Browser erlauben Audio oft erst nach einer Nutzer-Interaktion.
 * Diese Funktion MUSS direkt im Klick-Handler (vor dem ersten await)
 * aufgerufen werden. Danach darf dasselbe <audio>-Element später
 * ohne Klick abspielen.
 */
export function unlockAudio(audio: HTMLAudioElement | null) {
  if (!audio) return
  audio.muted = false
  audio.src = SILENT_WAV
  audio
    .play()
    .then(() => audio.pause())
    .catch(() => {
      /* wird später über den "Musik abspielen"-Button gelöst */
    })
}

/** Lädt eine URL in das Audio-Element und wartet, bis sie abspielbar ist. */
export function loadAudio(audio: HTMLAudioElement, url: string, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onError)
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Der Song konnte nicht geladen werden'))
    }
    // Manche Browser (iOS) laden erst beim Abspielen → nach Timeout trotzdem weiter.
    const timer = window.setTimeout(onReady, timeoutMs)
    audio.addEventListener('canplay', onReady)
    audio.addEventListener('error', onError)
    audio.volume = 1
    audio.src = url
    audio.load()
  })
}

/** Lautstärke sanft herunterfahren und pausieren */
export function fadeOut(audio: HTMLAudioElement | null, ms = 800): Promise<void> {
  return new Promise((resolve) => {
    if (!audio || audio.paused) {
      resolve()
      return
    }
    const start = audio.volume
    const steps = 16
    let i = 0
    const id = window.setInterval(() => {
      i++
      audio.volume = Math.max(0, start * (1 - i / steps))
      if (i >= steps) {
        window.clearInterval(id)
        audio.pause()
        audio.volume = 1
        resolve()
      }
    }, ms / steps)
  })
}
