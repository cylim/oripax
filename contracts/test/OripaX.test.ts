import { expect } from 'chai'
import hre from 'hardhat'

describe('OripaX', function () {
  async function deployFixture() {
    const [owner, user1] = await hre.ethers.getSigners()
    const OripaX = await hre.ethers.getContractFactory('OripaX')
    const oripax = await OripaX.deploy()
    return { oripax, owner, user1 }
  }

  it('Should deploy with correct name and symbol', async function () {
    const { oripax } = await deployFixture()
    expect(await oripax.name()).to.equal('OripaX')
    expect(await oripax.symbol()).to.equal('ORIPAX')
  })

  it('Should mint a card', async function () {
    const { oripax, user1 } = await deployFixture()
    await oripax.mintCard(
      user1!.address,
      1,
      42,
      2,
      'https://oripax.example.com/api/metadata/42'
    )
    expect(await oripax.ownerOf(1)).to.equal(user1!.address)
    expect(await oripax.totalMinted()).to.equal(1)
  })

  it('Should emit CardDrawn event', async function () {
    const { oripax, user1 } = await deployFixture()
    await expect(
      oripax.mintCard(user1!.address, 1, 42, 2, 'uri')
    )
      .to.emit(oripax, 'CardDrawn')
      .withArgs(1, user1!.address, 1, 42, 2)
  })

  it('Should mint Last One and emit event', async function () {
    const { oripax, user1 } = await deployFixture()
    await expect(oripax.mintLastOne(user1!.address, 1, 'lastoneuri'))
      .to.emit(oripax, 'LastOneWon')
      .withArgs(1, user1!.address, 1)

    const data = await oripax.cardData(1)
    expect(data.isLastOne).to.be.true
  })

  it('Should reject non-owner minting', async function () {
    const { oripax, user1 } = await deployFixture()
    await expect(
      oripax.connect(user1!).mintCard(user1!.address, 1, 1, 0, 'uri')
    ).to.be.revertedWithCustomError(oripax, 'OwnableUnauthorizedAccount')
  })
})
