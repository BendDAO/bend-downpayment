/* eslint-disable  no-unused-expressions */
import { expect } from "chai";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { ethers } from "hardhat";
import { constants } from "ethers";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "ethers/lib/utils";

makeSuite("BaseAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  before(async () => {
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  it("Revertions work as expected", async () => {
    await expect(
      contracts.punkAdapter
        .connect(env.admin)
        .executeOperation([contracts.weth.address], [0], [0], env.admin.address, "0x")
    ).to.revertedWith("Adapter: caller must be aave lending pool");

    await setBalance(contracts.aaveLendPool.address, parseEther("1"));

    await expect(
      contracts.punkAdapter
        .connect(await ethers.getImpersonatedSigner(contracts.aaveLendPool.address))
        .executeOperation([contracts.weth.address], [0], [0], env.admin.address, "0x")
    ).to.revertedWith("Adapter: flashloan initiator must be downpayment");

    await expect(
      contracts.punkAdapter
        .connect(await ethers.getImpersonatedSigner(contracts.aaveLendPool.address))
        .executeOperation(
          [contracts.weth.address, contracts.weth.address],
          [0, 0],
          [0, 0],
          contracts.downpayment.address,
          "0x"
        )
    ).to.revertedWith("Adapter: multiple assets not supported");

    await expect(
      contracts.punkAdapter
        .connect(await ethers.getImpersonatedSigner(contracts.aaveLendPool.address))
        .executeOperation([constants.AddressZero], [0], [0], contracts.downpayment.address, "0x")
    ).to.revertedWith("Adapter: only WETH borrowing allowed");

    await expect(
      env.admin.sendTransaction({
        to: contracts.punkAdapter.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      })
    ).to.revertedWith("Adapter: receive not allowed");

    await expect(
      contracts.punkAdapter
        .connect(env.admin)
        .initialize(constants.AddressZero, constants.AddressZero, constants.AddressZero)
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Owner work as expected", async () => {
    await expect(contracts.punkAdapter.connect(env.accounts[2]).unpause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(contracts.punkAdapter.connect(env.accounts[2]).pause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await expect(contracts.punkAdapter.connect(env.admin).unpause()).to.be.revertedWith("Pausable: not paused");

    expect(contracts.punkAdapter.connect(env.admin).pause()).to.be.ok;

    await expect(
      contracts.punkAdapter
        .connect(env.admin)
        .executeOperation([contracts.weth.address], [0], [0], env.admin.address, "0x")
    ).to.revertedWith("Pausable: paused");

    expect(contracts.punkAdapter.connect(env.admin).unpause()).to.be.ok;

    await expect(
      contracts.punkAdapter
        .connect(env.admin)
        .executeOperation([contracts.weth.address], [0], [0], env.admin.address, "0x")
    ).to.revertedWith("Adapter: caller must be aave lending pool");
  });
});
