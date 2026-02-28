// Service worker — opens side panel on Instagram, manages offscreen doc, relays messages

let offscreenCreated = false

// Open side panel automatically when user is on Instagram
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('instagram.com')) {
    chrome.sidePanel.setOptions({ tabId, enabled: true })
  }
})

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id! })
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'START_AUDIO':
    case 'START_AUDIO_PREFETCH':
      ensureOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', reelId: msg.reelId })
      })
      sendResponse({ ok: true })
      break

    case 'STOP_AUDIO':
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP', reelId: msg.reelId })
      sendResponse({ ok: true })
      break

    // Forward these to the side panel
    case 'REEL_CHANGED':
    case 'VIDEO_TIME':
    case 'REEL_PROCESSING':
    case 'REEL_CHECKED':
    case 'ASR_SEGMENT':
    case 'TRANSCRIPT_DONE':
      chrome.runtime.sendMessage(msg)
      // Also relay transcript events back to content script
      if (msg.type === 'ASR_SEGMENT' || msg.type === 'TRANSCRIPT_DONE') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, msg)
        })
      }
      break
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
