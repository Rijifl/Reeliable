import { analyzeReel } from './api'
import { AnalyzeReelResponse, ChromeMessage, ReelDetectedMessage, ReelPrefetchMessage } from './types'

const cache = new Map<string, AnalyzeReelResponse>()
const activeRequests = new Map<string, AbortController>()

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('instagram.com')) {
    chrome.sidePanel.setOptions({ tabId, enabled: true })
  }
})

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {})
})

chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
  if (message.type === 'REEL_DETECTED') {
    console.log('[ReelCheck bg] REEL_DETECTED received:', message.request.reelId, message.request.videoUrl)
    void handleReelDetected(message, sender.tab?.id)
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'REEL_PREFETCH') {
    void handleReelPrefetch(message)
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'REEL_CHANGED') {
    abortReel(message.reelId)
    forward(message, sender.tab?.id)
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'VIDEO_TIME') {
    chrome.runtime.sendMessage(message).catch(() => {})
    sendResponse({ ok: true })
    return true
  }

  return false
})

async function handleReelDetected(message: ReelDetectedMessage, tabId?: number) {
  const { request } = message
  const { reelId, creator } = request

  const cached = cache.get(reelId)
  if (cached) {
    forward({ type: 'ANALYSIS_COMPLETE', reelId, result: cached }, tabId)
    return
  }

  forward({ type: 'ANALYSIS_STARTED', reelId, creator }, tabId)

  console.log('[ReelCheck bg] fetching from server:', reelId)
  abortReel(reelId)
  const controller = new AbortController()
  activeRequests.set(reelId, controller)

  try {
    const result = await analyzeReel(request, controller.signal)
    if (controller.signal.aborted) return
    cache.set(reelId, result)
    forward({ type: 'ANALYSIS_COMPLETE', reelId, result }, tabId)
  } catch (err) {
    if (controller.signal.aborted) return
    const messageText = err instanceof Error ? err.message : String(err)
    console.log('[ReelCheck bg] ANALYSIS_ERROR:', messageText)
    forward({ type: 'ANALYSIS_ERROR', reelId, message: messageText }, tabId)
  } finally {
    const active = activeRequests.get(reelId)
    if (active === controller) activeRequests.delete(reelId)
  }
}

async function handleReelPrefetch(message: ReelPrefetchMessage) {
  const { request } = message
  const { reelId } = request

  if (cache.has(reelId)) return
  if (activeRequests.has(reelId)) return

  const controller = new AbortController()
  activeRequests.set(reelId, controller)

  try {
    const result = await analyzeReel(request, controller.signal)
    if (!controller.signal.aborted) {
      cache.set(reelId, result)
      console.log(`[ReelCheck] prefetch cached: ${reelId}`)
    }
  } catch {
    // Silent fail — prefetch errors don't need UI feedback
  } finally {
    const active = activeRequests.get(reelId)
    if (active === controller) activeRequests.delete(reelId)
  }
}

function abortReel(reelId: string) {
  const controller = activeRequests.get(reelId)
  if (!controller) return
  controller.abort()
  activeRequests.delete(reelId)
}

function forward(message: ChromeMessage, tabId?: number) {
  // Panel may not be open yet — ignore the "no receiving end" error
  chrome.runtime.sendMessage(message).catch(() => {})
  if (tabId) {
    chrome.tabs.sendMessage(tabId, message).catch(() => {})
  }
}
