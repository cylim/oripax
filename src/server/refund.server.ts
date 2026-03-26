import { ethers } from 'ethers'
import { USDT_CONTRACT_ADDRESS } from '~/lib/constants'
import { getEnv } from './env'

const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)']

export async function sendUsdtRefund(
  toAddress: string,
  amountUsdt: number
): Promise<{ txHash: string }> {
  const env = getEnv()
  const provider = new ethers.JsonRpcProvider(env.XLAYER_RPC)
  const wallet = new ethers.Wallet(env.MINTER_PRIVATE_KEY, provider)
  const usdt = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, wallet)

  // USDT has 6 decimals
  const amountWei = BigInt(Math.round(amountUsdt * 1e6))
  const tx = await usdt.transfer(toAddress, amountWei)
  const receipt = await tx.wait()

  return { txHash: receipt.hash }
}
