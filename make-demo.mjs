import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { createCanvas, GifEncoder, loadImage } from '@napi-rs/canvas'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9227
const browser = spawn(
  edgePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=C:\\tmp\\tailor-demo-browser',
    '--window-size=1440,960',
    'http://127.0.0.1:5173/',
  ],
  { windowsHide: true, stdio: 'ignore' },
)

const waitFor = async (test, timeout = 20000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      const value = await test()
      if (value) return value
    } catch {}
    await delay(250)
  }
  throw new Error('Timed out waiting for the demo browser.')
}

let socket
try {
  const version = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`)
    return response.ok ? response.json() : null
  })
  const page = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json`)
    const targets = await response.json()
    return targets.find((target) => target.type === 'page')
  })
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data)
    if (response.id && pending.has(response.id)) {
      const { resolve, reject } = pending.get(response.id)
      pending.delete(response.id)
      response.error ? reject(new Error(response.error.message)) : resolve(response.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  await waitFor(() => evaluate("document.querySelector('.empty h1')?.textContent"))
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await delay(700)
  const frames = []
  const capture = async () => {
    await delay(900)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    frames.push(Buffer.from(shot.data, 'base64'))
  }
  await capture()
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Try a sample resume'));
    button?.click();
  })()`)
  await waitFor(() => evaluate("document.querySelector('.workspace .editor') !== null"))
  await capture()
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.modeSwitch button')].find((item) => item.textContent.includes('Tailor'));
    button?.click();
  })()`)
  await waitFor(() => evaluate("document.querySelector('.tagbar') !== null"))
  await capture()

  const width = 1080
  const height = 720
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  const encoder = new GifEncoder(width, height, { repeat: 0, quality: 12 })
  const delays = [1400, 1900, 1900]
  for (let index = 0; index < frames.length; index += 1) {
    const image = await loadImage(frames[index])
    context.drawImage(image, 0, 0, width, height)
    encoder.addFrame(context.getImageData(0, 0, width, height).data, width, height, {
      delay: delays[index],
    })
  }
  await writeFile('public/tailor-demo.gif', encoder.finish())
  await fetch(version.webSocketDebuggerUrl.replace('ws:', 'http:'), { method: 'DELETE' }).catch(() => {})
} finally {
  socket?.close()
  browser.kill()
}
