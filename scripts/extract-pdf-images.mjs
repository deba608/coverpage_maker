/**
 * Extracts embedded images from a PDF at their original resolution.
 *
 * Logos pulled this way stay sharp in print; a screenshot crop of the same seal
 * does not. JPEG (DCTDecode) streams are written verbatim; Flate-compressed
 * bitmaps are inflated and re-encoded as PNG.
 *
 *   node scripts/extract-pdf-images.mjs <file.pdf> <out-dir>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync, deflateSync } from 'node:zlib'

const [, , file, outDir = '.'] = process.argv
if (!file) {
  console.error('usage: node scripts/extract-pdf-images.mjs <file.pdf> <out-dir>')
  process.exit(1)
}

const buf = readFileSync(file)
const text = buf.toString('latin1')
mkdirSync(outDir, { recursive: true })

/** CRC32, needed to build PNG chunks by hand. */
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

/** Wraps raw RGB/grey samples as a PNG (colour type 2 or 0). */
function encodePng(raw, width, height, channels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 3 ? 2 : 0
  const stride = width * channels
  // PNG requires a filter byte at the start of every scanline.
  const filtered = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const dictRe = /<<([^>]*?\/Subtype\s*\/Image[\s\S]*?)>>\s*stream\r?\n/g
let match
let found = 0

while ((match = dictRe.exec(text)) !== null) {
  const dict = match[1]
  const start = match.index + match[0].length
  const end = text.indexOf('endstream', start)
  if (end === -1) continue

  const num = (key) => Number(new RegExp(`/${key}\\s+(\\d+)`).exec(dict)?.[1])
  const width = num('Width')
  const height = num('Height')
  const filter = /\/Filter\s*\/?\[?\s*\/(\w+)/.exec(dict)?.[1]
  const colorSpace = /\/ColorSpace\s*\/?(\w+)/.exec(dict)?.[1] ?? ''
  const bpc = num('BitsPerComponent')
  if (!width || !height) continue

  const stream = buf.subarray(start, end)
  const base = join(outDir, `image-${++found}`)

  try {
    if (filter === 'DCTDecode') {
      writeFileSync(`${base}.jpg`, stream)
      console.log(`${base}.jpg  ${width}x${height}  jpeg`)
    } else if (filter === 'FlateDecode') {
      const raw = inflateSync(stream)
      const channels = Math.round(raw.length / (width * height))
      if (bpc === 8 && (channels === 3 || channels === 1)) {
        writeFileSync(`${base}.png`, encodePng(raw, width, height, channels))
        console.log(`${base}.png  ${width}x${height}  ${channels === 3 ? 'rgb' : 'grey'}`)
      } else {
        writeFileSync(`${base}.bin`, raw)
        console.log(
          `${base}.bin  ${width}x${height}  ${bpc}bpc ${colorSpace} — unhandled, raw samples written`,
        )
      }
    } else {
      console.log(`skipped ${width}x${height}: filter ${filter ?? 'none'} not handled`)
    }
  } catch (err) {
    console.log(`failed ${width}x${height}: ${err.message}`)
  }
}

if (!found) console.log('no extractable images found')
