import { ethers } from 'ethers'
import { USDC_CONTRACT_ADDRESS } from '~/lib/constants'
import { getMinterWallet } from './rpc'

const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)']

export async function sendUsdtRefund(
  toAddress: string,
  amountUsdt: number
): Promise<{ txHash: string }> {
  const wallet = getMinterWallet()
  const usdc = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, wallet)

  // USDC has 6 decimals
  const amountWei = BigInt(Math.round(amountUsdt * 1e6))
  const tx = await usdc.transfer(toAddress, amountWei)
  const receipt = await tx.wait()

  return { txHash: receipt.hash }
}
