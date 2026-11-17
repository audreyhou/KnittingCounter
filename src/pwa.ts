interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach((l) => l())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((l) => l())
})

export const installPrompt = () => deferred

export function onInstallChange(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
