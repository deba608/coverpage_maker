/**
 * Minimal ZIP writer — STORE method only, no compression.
 *
 * PDFs are already deflate-compressed internally, so zipping them again buys
 * ~nothing; STORE keeps this dependency-free (~80 lines) and byte-exact. The
 * output is a plain ZIP any OS opens natively.
 */

interface Entry {
  name: string
  data: Uint8Array
  crc: number
  offset: number
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export class ZipWriter {
  private chunks: Uint8Array[] = []
  private entries: Entry[] = []
  private offset = 0

  add(name: string, data: Uint8Array): void {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(data)
    const header = new DataView(new ArrayBuffer(30))
    header.setUint32(0, 0x04034b50, true) // local file header signature
    header.setUint16(4, 20, true) // version needed
    header.setUint16(6, 0x0800, true) // UTF-8 names
    header.setUint16(8, 0, true) // STORE
    header.setUint16(10, 0, true) // mod time (zeroed — content, not history)
    header.setUint16(12, 0, true) // mod date
    header.setUint32(14, crc, true)
    header.setUint32(18, data.length, true) // compressed size (= raw for STORE)
    header.setUint32(22, data.length, true) // uncompressed size
    header.setUint16(26, nameBytes.length, true)
    header.setUint16(28, 0, true) // extra length

    this.entries.push({ name, data, crc, offset: this.offset })
    this.push(new Uint8Array(header.buffer))
    this.push(nameBytes)
    this.push(data)
  }

  /** Central directory + end record → the finished .zip bytes. */
  finish(): Blob {
    const dirStart = this.offset
    for (const e of this.entries) {
      const nameBytes = new TextEncoder().encode(e.name)
      const rec = new DataView(new ArrayBuffer(46))
      rec.setUint32(0, 0x02014b50, true) // central directory signature
      rec.setUint16(4, 20, true) // version made by
      rec.setUint16(6, 20, true) // version needed
      rec.setUint16(8, 0x0800, true) // UTF-8 names
      rec.setUint16(10, 0, true) // STORE
      rec.setUint32(16, e.crc, true)
      rec.setUint32(20, e.data.length, true)
      rec.setUint32(24, e.data.length, true)
      rec.setUint16(28, nameBytes.length, true)
      rec.setUint32(42, e.offset, true)
      this.push(new Uint8Array(rec.buffer))
      this.push(nameBytes)
    }
    const dirSize = this.offset - dirStart

    const end = new DataView(new ArrayBuffer(22))
    end.setUint32(0, 0x06054b50, true) // end of central directory signature
    end.setUint16(8, this.entries.length, true)
    end.setUint16(10, this.entries.length, true)
    end.setUint32(12, dirSize, true)
    end.setUint32(16, dirStart, true)
    this.push(new Uint8Array(end.buffer))

    return new Blob(this.chunks as BlobPart[], { type: 'application/zip' })
  }

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes)
    this.offset += bytes.length
  }
}
