/**
 * MAIN world entry point for the reel ID extractor.
 *
 * Runs inside the page's JavaScript context so it can access React fiber
 * properties (__reactFiber$...) that are invisible to isolated content scripts.
 *
 * For every <video> it finds, it walks the fiber tree to get the reel shortcode,
 * then posts a REEL_IDENTITY message to the isolated world via window.postMessage.
 * chrome.* APIs are NOT available here.
 */

import { walkFiberTree } from './reel-id-extractor'

const seen = new Set<string>()

function scanAndPost() {
  const videos = document.querySelectorAll<HTMLVideoElement>('video')
  videos.forEach((video) => {
    const videoUrl = video.currentSrc?.trim()
    if (!videoUrl || videoUrl.startsWith('blob:')) return

    const result = walkFiberTree(video)
    if (!result) return

    if (seen.has(result.shortcode)) return
    seen.add(result.shortcode)

    window.postMessage(
      {
        source: 'REELCHECK_MAIN',
        type: 'REEL_IDENTITY',
        shortcode: result.shortcode,
        mediaId: result.mediaId,
        videoUrl,
      },
      '*',
    )
  })
}

setInterval(scanAndPost, 2000)
scanAndPost()
