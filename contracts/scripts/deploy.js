const { ethers } = require('hardhat')

async function main() {
  const minterAddress = process.env.MINTER_ADDRESS
  if (!minterAddress) {
    throw new Error('Set MINTER_ADDRESS env var (the wallet that will mint NFTs and send refunds)')
  }

  const OripaX = await ethers.getContractFactory('OripaX')
  console.log(`Deploying OripaX with minter: ${minterAddress}...`)
  const oripax = await OripaX.deploy(minterAddress)
  await oripax.waitForDeployment()
  const address = await oripax.getAddress()
  console.log(`OripaX deployed to: ${address}`)
  console.log(`Owner (deployer): ${(await ethers.provider.getSigner()).address}`)
  console.log(`Minter: ${minterAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
