/**
 * Extracts a PDF's logo as a transparent PNG.
 *
 * PDF stores a soft-masked image as two streams: the colour bitmap and a
 * greyscale /SMask holding its alpha. Extracted separately they look useless —
 * the colour half of a black line-art seal is a solid black rectangle. This
 * pairs them back up and writes RGBA.
 *
 *   node scripts/extract-pdf-logo.mjs <file.pdf> <out.png>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'

const [, , file, out] = process.argv
if (!file || !out) {
  console.error('usage: node scripts/extract-pdf-logo.mjs <file.pdf> <out.png>')
  process.exit(1)
}

const buf = readFileSync(file)
const text = buf.toString('latin1')

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes) {
  let c = 0xffffffff
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** RGBA (colour type 6) PNG. */
function encodePngRgba(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const filtered = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0
    rgba.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Collect every Flate-compressed image stream in document order.
const images = []
const dictRe = /<<([^>]*?\/Subtype\s*\/Image[\s\S]*?)>>\s*stream\r?\n/g
let match
while ((match = dictRe.exec(text)) !== null) {
  const dict = match[1]
  const start = match.index + match[0].length
  const end = text.indexOf('endstream', start)
  if (end === -1) continue
  const num = (key) => Number(new RegExp(`/${key}\\s+(\\d+)`).exec(dict)?.[1])
  const filter = /\/Filter\s*\/?\[?\s*\/(\w+)/.exec(dict)?.[1]
  if (filter !== 'FlateDecode') continue
  const width = num('Width')
  const height = num('Height')
  if (!width || !height) continue
  const data = inflateSync(buf.subarray(start, end))
  images.push({ width, height, data, channels: Math.round(data.length / (width * height)) })
}

// The mask is the 1-channel image sharing the colour image's dimensions.
const colour = images.find((i) => i.channels === 3)
if (!colour) {
  console.error('no 8-bit RGB image found')
  process.exit(1)
}
const mask = images.find(
  (i) => i.channels === 1 && i.width === colour.width && i.height === colour.height,
)

const { width, height } = colour
const rgba = Buffer.alloc(width * height * 4)
for (let p = 0; p < width * height; p++) {
  rgba[p * 4] = colour.data[p * 3]
  rgba[p * 4 + 1] = colour.data[p * 3 + 1]
  rgba[p * 4 + 2] = colour.data[p * 3 + 2]
  rgba[p * 4 + 3] = mask ? mask.data[p] : 255
}

writeFileSync(out, encodePngRgba(rgba, width, height))
console.log(
  `${out}  ${width}x${height}  ${mask ? 'with alpha from /SMask' : 'opaque (no mask found)'}`,
)
if (width < 800) {
  console.log(
    `warning: ${width}px wide. At 55mm that is ~${Math.round(width / (55 / 25.4))} dpi — soft in print. ` +
      'A higher-resolution source is worth finding.',
  )
}
