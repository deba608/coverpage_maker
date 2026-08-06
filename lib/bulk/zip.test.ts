import { describe, expect, it } from 'vitest'
import { ZipWriter } from './zip'

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function u32(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0
}
function u16(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8)
}

describe('ZipWriter', () => {
  it('produces a structurally valid single-entry archive', async () => {
    const zip = new ZipWriter()
    const data = new TextEncoder().encode('hello zip')
    zip.add('a.pdf', data)
    const b = await bytes(zip.finish())

    expect(u32(b, 0)).toBe(0x04034b50) // local header at offset 0

    const endAt = b.length - 22
    expect(u32(b, endAt)).toBe(0x06054b50) // end of central directory
    expect(u16(b, endAt + 8)).toBe(1) // one entry

    const dirAt = u32(b, endAt + 16)
    expect(u32(b, dirAt)).toBe(0x02014b50) // central directory record
    expect(u32(b, dirAt + 20)).toBe(data.length) // stored size

    // STORE method: the raw bytes appear verbatim after header+name.
    const payload = b.slice(30 + 'a.pdf'.length, 30 + 'a.pdf'.length + data.length)
    expect(new TextDecoder().decode(payload)).toBe('hello zip')
  })

  it('counts every added entry in the end record', async () => {
    const zip = new ZipWriter()
    zip.add('one.pdf', new Uint8Array([1]))
    zip.add('two.pdf', new Uint8Array([2, 3]))
    const b = await bytes(zip.finish())
    expect(u16(b, b.length - 22 + 8)).toBe(2)
  })
})
