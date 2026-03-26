const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT, Authorization',
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  })
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status)
}

export function jsonResponseWithCookie(
  data: unknown,
  cookieName: string,
  cookieValue: string,
  maxAge: number,
  status = 200
): Response {
  const res = jsonResponse(data, status)
  res.headers.set(
    'Set-Cookie',
    `${cookieName}=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  )
  return res
}

export function clearCookieResponse(
  data: unknown,
  cookieName: string,
  status = 200
): Response {
  const res = jsonResponse(data, status)
  res.headers.set(
    'Set-Cookie',
    `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  )
  return res
}
