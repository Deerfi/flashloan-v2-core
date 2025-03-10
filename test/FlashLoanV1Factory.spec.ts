import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero } from 'ethers/constants'
import { bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { getCreate2Address } from './shared/utilities'
import { factoryFixture } from './shared/fixtures'

import FlashLoanV1Pool from '../build/FlashLoanV1Pool.json'

chai.use(solidity)

const TEST_ADDRESSES: string = '0x1000000000000000000000000000000000000000'

describe('FlashLoanV1Factory', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, other])

  let factory: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    factory = fixture.factory
  })

  it('feeInBips, feeTo, feeToSetter, allPoolsLength', async () => {
    expect(await factory.feeInBips()).to.eq(5)
    expect(await factory.feeTo()).to.eq(AddressZero)
    expect(await factory.feeToSetter()).to.eq(wallet.address)
    expect(await factory.allPoolsLength()).to.eq(0)
  })

  async function createPool(token: string) {
    const bytecode = `0x${FlashLoanV1Pool.evm.bytecode.object}`
    const create2Address = getCreate2Address(factory.address, token, bytecode)
    await expect(factory.createPool(token))
      .to.emit(factory, 'PoolCreated')
      .withArgs(TEST_ADDRESSES, create2Address, bigNumberify(1))

    await expect(factory.createPool(token)).to.be.reverted // FlashLoanV1: POOL_EXISTS
    expect(await factory.getPool(token)).to.eq(create2Address)
    expect(await factory.allPools(0)).to.eq(create2Address)
    expect(await factory.allPoolsLength()).to.eq(1)

    const pool = new Contract(create2Address, JSON.stringify(FlashLoanV1Pool.abi), provider)
    expect(await pool.factory()).to.eq(factory.address)
    expect(await pool.token()).to.eq(TEST_ADDRESSES)
  }

  it('createPool', async () => {
    await createPool(TEST_ADDRESSES)
  })

  it('createPool:gas', async () => {
    const tx = await factory.createPool(TEST_ADDRESSES)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(1949464)
  })

  it('setFeeInBips', async () => {
    await expect(factory.connect(other).setFeeInBips(1)).to.be.revertedWith('FlashLoanV1: FORBIDDEN')
    await factory.setFeeInBips(2)
    expect(await factory.feeInBips()).to.eq(2)
  })

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('FlashLoanV1: FORBIDDEN')
    await factory.setFeeTo(wallet.address)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  it('setFeeToSetter', async () => {
    await expect(factory.connect(other).setFeeToSetter(other.address)).to.be.revertedWith('FlashLoanV1: FORBIDDEN')
    await factory.setFeeToSetter(other.address)
    expect(await factory.feeToSetter()).to.eq(other.address)
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith('FlashLoanV1: FORBIDDEN')
  })
})
