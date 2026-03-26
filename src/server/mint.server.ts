import { ethers } from 'ethers'
import { OripaXABI } from '~/lib/OripaXABI'
import { XLAYER_EXPLORER } from '~/lib/constants'
import { getEnv } from './env'
import { getMinterWallet } from './rpc'

function getContract(wallet: ethers.Wallet) {
  const env = getEnv()
  return new ethers.Contract(env.CONTRACT_ADDRESS, OripaXABI, wallet)
}

const RARITY_MAP: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  ultra_rare: 3,
  secret_rare: 4,
}

export async function mintCardOnChain(
  to: string,
  oripaId: number,
  cardNumber: number,
  rarity: string,
  metadataBaseUrl: string
) {
  const wallet = getMinterWallet()
  const contract = getContract(wallet)
  const tokenURI = `${metadataBaseUrl}/api/metadata/${cardNumber}`
  const rarityNum = RARITY_MAP[rarity] ?? 0

  const tx = await contract.mintCard(to, oripaId, cardNumber, rarityNum, tokenURI)
  const receipt = await tx.wait()

  // Parse tokenId from event
  const event = receipt.logs.find(
    (log: ethers.Log) => {
      try {
        const parsed = contract.interface.parseLog(log)
        return parsed?.name === 'CardDrawn'
      } catch {
        return false
      }
    }
  )

  const tokenId = event
    ? contract.interface.parseLog(event)?.args[0]
    : null

  return {
    txHash: receipt.hash,
    tokenId: tokenId ? Number(tokenId) : null,
    explorerUrl: `${XLAYER_EXPLORER}/tx/${receipt.hash}`,
  }
}

export async function mintLastOneOnChain(
  to: string,
  oripaId: number,
  metadataBaseUrl: string
) {
  const wallet = getMinterWallet()
  const contract = getContract(wallet)
  const tokenURI = `${metadataBaseUrl}/api/metadata/99`

  const tx = await contract.mintLastOne(to, oripaId, tokenURI)
  const receipt = await tx.wait()

  const event = receipt.logs.find(
    (log: ethers.Log) => {
      try {
        const parsed = contract.interface.parseLog(log)
        return parsed?.name === 'LastOneWon'
      } catch {
        return false
      }
    }
  )

  const tokenId = event
    ? contract.interface.parseLog(event)?.args[0]
    : null

  return {
    txHash: receipt.hash,
    tokenId: tokenId ? Number(tokenId) : null,
    explorerUrl: `${XLAYER_EXPLORER}/tx/${receipt.hash}`,
  }
}
