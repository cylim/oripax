export interface OKXAuthHeaders {
  'OK-ACCESS-KEY': string
  'OK-ACCESS-SIGN': string
  'OK-ACCESS-TIMESTAMP': string
  'OK-ACCESS-PASSPHRASE': string
}

export interface OKXApiResponse<T = unknown> {
  code: string
  msg: string
  data: T[]
}
