import { ethers } from 'hardhat'

async function main() {
  const OripaX = await ethers.getContractFactory('OripaX')
  console.log('Deploying OripaX...')
  const oripax = await OripaX.deploy()
  await oripax.waitForDeployment()
  const address = await oripax.getAddress()
  console.log(`OripaX deployed to: ${address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
