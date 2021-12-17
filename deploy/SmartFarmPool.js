module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const LPToken = await deploy("ERC20Mock", {
    from: deployer,
    args: ["LPToken", "LP", "10000000000000000000000000000"],
    log: true,
    deterministicDeployment: false
  })

  const token1 = await deploy("ERC20Mock", {
    from: deployer,
    args: ["Token1", "TKN1", "10000000000000000000000"],
    log: true,
    deterministicDeployment: false
  })

  const token2 = await deploy("ERC20Mock", {
    from: deployer,
    args: ["Token2", "TKN2", "10000000000000000000000"],
    log: true,
    deterministicDeployment: false
  })

  const token3 = await deploy("ERC20Mock", {
    from: deployer,
    args: ["Token3", "TKN3", "10000000000000000000000"],
    log: true,
    deterministicDeployment: false
  })

  const SmartFarm = await deploy("SmartFarmPool", {
    from: deployer,
    args: [
      LPToken.address,
      token1.address,
      token2.address,
      token3.address,

      "10000000000000000000", // 10 token1
      "20000000000000000000", // 20 token2
      "30000000000000000000", // 30 token3

      "0"
    ],
    log: true,
    deterministicDeployment: false
  })

  console.log('LP token Address -> ',LPToken.address);
  console.log('Token1 Address -> ',token1.address);
  console.log('Token2 Address -> ',token2.address);
  console.log('Token3 Address -> ',token3.address);
  console.log('SmartFarm Pool Address -> ',  SmartFarm.address)

  const SmartFarmInstance = await ethers.getContract("SmartFarmPool")
  await (await SmartFarmInstance.transferOwnership('0x45f82a76D7FCd2a957357686197FF8dA08350B7a')).wait()

  const tokenContract = await ethers.getContractFactory("ERC20Mock")

  const LPTokenContract = await tokenContract.attach(LPToken.address)
  const token1Contract = await tokenContract.attach(token1.address)
  const token2Contract = await tokenContract.attach(token2.address)
  const token3Contract = await tokenContract.attach(token3.address)

  await token1Contract.transfer(SmartFarmInstance.address, "1000000000000000000000")
  await token2Contract.transfer(SmartFarmInstance.address, "2000000000000000000000")
  await token3Contract.transfer(SmartFarmInstance.address, "3000000000000000000000")
  await LPTokenContract.transfer('0x2f6BC85Ae7bfB35338c999f7bcC062bfCE10FCeD', "1000000000000000000000") // to tester

}

module.exports.tags = ["SmartFarmPool"]