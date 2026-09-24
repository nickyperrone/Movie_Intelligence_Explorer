const DEVICE_KEY = 'device-id'

// A random id for this browser, so the daily question allowance is per device rather than per
// office network (docs/06-llm.md, "Usage limits"). Without storage the server falls back to the
// address.
export function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return undefined
  }
}
