import { createCipheriv, createHash, createHmac, pbkdf2, randomFillSync } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { gunzipSync, deflateSync } from 'node:zlib'
import { BaseCryptoProvider } from '@mtcute/core/utils.js'
import { SIMD_AVAILABLE, ige256Decrypt, ige256Encrypt, initSync } from '@mtcute/wasm'
import simdWasmFile from '@mtcute/wasm/mtcute-simd.wasm'
import wasmFile from '@mtcute/wasm/mtcute.wasm'

export class TgsmCryptoProvider extends BaseCryptoProvider {
  createAesCtr(key: Uint8Array, iv: Uint8Array, _encrypt = true) {
    const cipher = createCipheriv(`aes-${key.length * 8}-ctr`, key, iv)
    const update = (data: Uint8Array) => cipher.update(data)

    return {
      process: update,
    }
  }

  pbkdf2(password: Uint8Array, salt: Uint8Array, iterations: number, keylen = 64, algo = 'sha512') {
    return new Promise<Buffer>((resolve, reject) => {
      pbkdf2(password, salt, iterations, keylen, algo, (error, buffer) => {
        if (error) {
          reject(error)
          return
        }

        resolve(buffer)
      })
    })
  }

  sha1(data: Uint8Array): Buffer {
    return createHash('sha1').update(data).digest()
  }

  sha256(data: Uint8Array): Buffer {
    return createHash('sha256').update(data).digest()
  }

  hmacSha256(data: Uint8Array, key: Uint8Array): Buffer {
    return createHmac('sha256', key).update(data).digest()
  }

  gzip(data: Uint8Array, maxSize: number): Buffer | null {
    try {
      return deflateSync(data, { maxOutputLength: maxSize })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
        return null
      }

      throw error
    }
  }

  gunzip(data: Uint8Array): Buffer {
    return gunzipSync(data)
  }

  randomFill(buffer: Uint8Array): void {
    randomFillSync(buffer)
  }

  async initialize(): Promise<void> {
    const wasm = await readFile(SIMD_AVAILABLE ? simdWasmFile : wasmFile)
    initSync(wasm)
  }

  createAesIge(key: Uint8Array, iv: Uint8Array) {
    return {
      encrypt(data: Uint8Array): Uint8Array {
        return ige256Encrypt(data, key, iv)
      },
      decrypt(data: Uint8Array): Uint8Array {
        return ige256Decrypt(data, key, iv)
      },
    }
  }
}
