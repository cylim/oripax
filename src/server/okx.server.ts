import { getEnv } from './env'

function getSecrets() {
  const env = getEnv()
  return {
    apiKey: env.OKX_API_KEY,
    secretKey: env.OKX_SECRET_KEY,
    passphrase: env.OKX_PASSPHRASE,
  }
}

async function signRequest(
  method: string,
  path: string,
  body: string = ''
): Promise<{ timestamp: string; sign: string }> {
  const { secretKey } = getSecrets()
  const timestamp = new Date().toISOString()
  const prehash = timestamp + method.toUpperCase() + path + body

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash))
  const sign = btoa(String.fromCharCode(...new Uint8Array(signature)))

  return { timestamp, sign }
}

export async function okxFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const { apiKey, passphrase } = getSecrets()
  const bodyStr = body ? JSON.stringify(body) : ''
  const { timestamp, sign } = await signRequest(method, path, bodyStr)

  return fetch(`https://www.okx.com${path}`, {
    method,
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    },
    body: body ? bodyStr : undefined,
  })
}
