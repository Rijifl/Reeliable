// Service worker — message relay and extension state

let offscreenCreated = false

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_AUDIO') {
    ensureOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', reelId: msg.reelId })
    })
    sendResponse({ ok: true })
  }

  if (msg.type === 'STOP_AUDIO') {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' })
    sendResponse({ ok: true })
  }

  // Relay ASR transcript from offscreen → content script
  if (msg.type === 'ASR_TRANSCRIPT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg)
      }
    })
  }

  return true
})

async function ensureOffscreenDocument() {
  if (offscreenCreated) return
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Capture tab audio for ASR transcription',
  })
  offscreenCreated = true
}
