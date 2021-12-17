import { ethers } from "hardhat";
import { expect } from "chai";
import { advanceBlockTo } from "./utilities";

describe("SmartFarmPool", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.SmartFarmPool = await ethers.getContractFactory("SmartFarmPool")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  it("should set correct state variables", async function () {
    this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")
    this.token1 = await this.ERC20Mock.deploy("Token1", "TKN1", "1000")
    this.token2 = await this.ERC20Mock.deploy("Token2", "TKN2", "2000")
    this.token3 = await this.ERC20Mock.deploy("Token3", "TKN3", "3000")

    this.smartFarm = await this.SmartFarmPool.deploy(
      this.lp.address,
      this.token1.address,
      this.token2.address,
      this.token3.address,

      "10", //token1PerBlock
      "20", //token2PerBlock
      "30", //token3PerBlock

      "0", //startBlock
    )

    await this.smartFarm.deployed()

    const token1 = await this.smartFarm.token1()
    const token2 = await this.smartFarm.token2()
    const token3 = await this.smartFarm.token3()

    expect(token1).to.equal(this.token1.address)
    expect(token2).to.equal(this.token2.address)
    expect(token3).to.equal(this.token3.address)
  })


  context("With ERC/LP token added to the field", function () {
    beforeEach(async function () {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")

      await this.lp.transfer(this.alice.address, "1000")

      await this.lp.transfer(this.bob.address, "1000")

      await this.lp.transfer(this.carol.address, "1000")
    })

    it("should allow emergency withdraw", async function () {
      this.token1 = await this.ERC20Mock.deploy("Token1", "TKN1", "1000")
      this.token2 = await this.ERC20Mock.deploy("Token2", "TKN2", "2000")
      this.token3 = await this.ERC20Mock.deploy("Token3", "TKN3", "3000")

      this.smartFarm = await this.SmartFarmPool.deploy(
        this.lp.address,
        this.token1.address,
        this.token2.address,
        this.token3.address,

        "10", //token1PerBlock
        "20", //token2PerBlock
        "30", //token3PerBlock

        "100", //startBlock
      )

      await this.smartFarm.deployed()

      await this.lp.connect(this.bob).approve(this.smartFarm.address, "1000")

      await this.smartFarm.connect(this.bob).deposit("100")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.smartFarm.connect(this.bob).emergencyWithdraw()

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should give out TOKENs only after farming time", async function () {
      // 10, 20, 30 per block farming rate starting at block 100
      this.token1 = await this.ERC20Mock.deploy("Token1", "TKN1", "1000")
      this.token2 = await this.ERC20Mock.deploy("Token2", "TKN2", "2000")
      this.token3 = await this.ERC20Mock.deploy("Token3", "TKN3", "3000")

      this.smartFarm = await this.SmartFarmPool.deploy(
        this.lp.address,
        this.token1.address,
        this.token2.address,
        this.token3.address,

        "10", //token1PerBlock
        "20", //token2PerBlock
        "30", //token3PerBlock

        "100", //startBlock
      )

      await this.smartFarm.deployed()

      await this.token1.transfer(this.smartFarm.address, "1000")
      await this.token2.transfer(this.smartFarm.address, "2000")
      await this.token3.transfer(this.smartFarm.address, "3000")

      await this.lp.connect(this.bob).approve(this.smartFarm.address, "1000")
      await this.smartFarm.connect(this.bob).deposit("100")
      await advanceBlockTo("89")

      await this.smartFarm.connect(this.bob).deposit("0") // block 90
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("94")

      await this.smartFarm.connect(this.bob).deposit("0") // block 95
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("99")

      await this.smartFarm.connect(this.bob).deposit("0") // block 100
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("100")

      await this.smartFarm.connect(this.bob).deposit("0") // block 101
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("10")
      expect(await this.token2.balanceOf(this.bob.address)).to.equal("20")
      expect(await this.token3.balanceOf(this.bob.address)).to.equal("30")

      await advanceBlockTo("104")
      await this.smartFarm.connect(this.bob).deposit("0") // block 105
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("50")
      expect(await this.token2.balanceOf(this.bob.address)).to.equal("100")
      expect(await this.token3.balanceOf(this.bob.address)).to.equal("150")
    })

    it("should distribute TOKENs properly for each staker", async function () {
      // 10, 20, 30 per block farming rate starting at block 300
      this.token1 = await this.ERC20Mock.deploy("Token1", "TKN1", "1000")
      this.token2 = await this.ERC20Mock.deploy("Token2", "TKN2", "2000")
      this.token3 = await this.ERC20Mock.deploy("Token3", "TKN3", "3000")

      this.smartFarm = await this.SmartFarmPool.deploy(
        this.lp.address,
        this.token1.address,
        this.token2.address,
        this.token3.address,

        "10", //token1PerBlock
        "20", //token2PerBlock
        "30", //token3PerBlock

        "300", //startBlock
      )

      await this.smartFarm.deployed()

      await this.token1.transfer(this.smartFarm.address, "1000")
      await this.token2.transfer(this.smartFarm.address, "2000")
      await this.token3.transfer(this.smartFarm.address, "3000")

      await this.lp.connect(this.alice).approve(this.smartFarm.address, "1000", {
        from: this.alice.address,
      })
      await this.lp.connect(this.bob).approve(this.smartFarm.address, "1000", {
        from: this.bob.address,
      })
      await this.lp.connect(this.carol).approve(this.smartFarm.address, "1000", {
        from: this.carol.address,
      })
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo("309")
      await this.smartFarm.connect(this.alice).deposit("10", { from: this.alice.address })
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo("313")
      await this.smartFarm.connect(this.bob).deposit("20", { from: this.bob.address })
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo("317")
      await this.smartFarm.connect(this.carol).deposit("30", { from: this.carol.address })
      // Alice deposits 10 more LPs at block 320.
      await advanceBlockTo("319")
      await this.smartFarm.connect(this.alice).deposit("10", { from: this.alice.address })

      expect(await this.token1.balanceOf(this.alice.address)).to.equal("56")
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.token1.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.token1.balanceOf(this.smartFarm.address)).to.equal("944")

      expect(await this.token2.balanceOf(this.alice.address)).to.equal("113")
      expect(await this.token2.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.token2.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.token2.balanceOf(this.smartFarm.address)).to.equal("1887")

      expect(await this.token3.balanceOf(this.alice.address)).to.equal("170")
      expect(await this.token3.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.token3.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.token3.balanceOf(this.smartFarm.address)).to.equal("2830")

      // Bob withdraws 5 LPs at block 330.
      await advanceBlockTo("329")
      await this.smartFarm.connect(this.bob).withdraw("5", { from: this.bob.address })

      expect(await this.token1.balanceOf(this.alice.address)).to.equal("56")
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("61")
      expect(await this.token1.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.token1.balanceOf(this.smartFarm.address)).to.equal("883")

      expect(await this.token2.balanceOf(this.alice.address)).to.equal("113")
      expect(await this.token2.balanceOf(this.bob.address)).to.equal("123")
      expect(await this.token2.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.token2.balanceOf(this.smartFarm.address)).to.equal("1764")

      expect(await this.token3.balanceOf(this.alice.address)).to.equal("170")
      expect(await this.token3.balanceOf(this.bob.address)).to.equal("185")
      expect(await this.token3.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.token3.balanceOf(this.smartFarm.address)).to.equal("2645")

      const pendingTokensDataAlice = await this.smartFarm.connect(this.alice).pendingTokens(this.alice.address)
      expect(pendingTokensDataAlice.token1Pending).to.equal("28")
      expect(pendingTokensDataAlice.token2Pending).to.equal("57")
      expect(pendingTokensDataAlice.token3Pending).to.equal("85")

      const pendingTokensDataBob = await this.smartFarm.connect(this.bob).pendingTokens(this.bob.address)
      expect(pendingTokensDataBob.token1Pending).to.equal("0")
      expect(pendingTokensDataBob.token2Pending).to.equal("0")
      expect(pendingTokensDataBob.token3Pending).to.equal("0")

      const pendingTokensDataCarol = await this.smartFarm.connect(this.carol).pendingTokens(this.carol.address)
      expect(pendingTokensDataCarol.token1Pending).to.equal("53")
      expect(pendingTokensDataCarol.token2Pending).to.equal("106")
      expect(pendingTokensDataCarol.token3Pending).to.equal("158")

      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo("339")
      await this.smartFarm.connect(this.alice).withdraw("20", { from: this.alice.address })
      await advanceBlockTo("349")
      await this.smartFarm.connect(this.bob).withdraw("15", { from: this.bob.address })
      await advanceBlockTo("359")
      await this.smartFarm.connect(this.carol).withdraw("30", { from: this.carol.address })

      // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
      expect(await this.token1.balanceOf(this.alice.address)).to.equal("115")
      expect(await this.token2.balanceOf(this.alice.address)).to.equal("232")
      expect(await this.token3.balanceOf(this.alice.address)).to.equal("348")

      // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
      expect(await this.token1.balanceOf(this.bob.address)).to.equal("117")
      expect(await this.token2.balanceOf(this.bob.address)).to.equal("236")
      expect(await this.token3.balanceOf(this.bob.address)).to.equal("354")

      // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
      expect(await this.token1.balanceOf(this.carol.address)).to.equal("266")
      expect(await this.token2.balanceOf(this.carol.address)).to.equal("532")
      expect(await this.token3.balanceOf(this.carol.address)).to.equal("797")

      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })
  })
})