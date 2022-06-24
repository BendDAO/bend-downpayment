import { expect } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { waitForTx } from "../../tasks/utils/helpers";
import { assertAlmostEqualTol } from "../helpers/equals";
import { createSignedFlashloanParams } from "../signer/punk";
const { parseEther } = utils;

makeSuite("PunkAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: number;
  let sellPrice: BigNumber;
  let borrowAmount: BigNumber;
  let nonce: BigNumber;
  before(async () => {
    buyer = env.accounts[1];
    seller = env.accounts[2];
    tokenId = 8676;

    sellPrice = parseEther("10");
    waitForTx(await contracts.punkMarket.connect(seller).getPunk(tokenId));
    waitForTx(await contracts.punkMarket.connect(seller).offerPunkForSale(tokenId, sellPrice));
    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(
      contracts.wrappedPunk.address,
      contracts.weth.address
    );
    borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    nonce = await contracts.downpayment.nonces(buyer.address);
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function exceptDownpaymentSuccessed(price: BigNumber, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const bendFee = price.mul(env.fee).div(10000);
    const paymentAmount = price.add(aaveFee).add(bendFee).sub(borrowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorBWethBalance = (await contracts.bWETH.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);
    const dataWithSig = createSignedFlashloanParams(
      buyer,
      env.chainId,
      nonce,
      contracts.punkAdapter.address,
      tokenId,
      price
    );
    waitForTx(
      await contracts.downpayment
        .connect(buyer)
        .buy(contracts.punkAdapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    );

    expect(await contracts.punkMarket.punkIndexToAddress(tokenId)).to.be.equal(contracts.wrappedPunk.address);

    expect(await contracts.wrappedPunk.ownerOf(tokenId)).to.be.equal(contracts.bWPUNK.address);
    expect(await contracts.bWPUNK.ownerOf(tokenId)).to.be.equal(buyer.address);

    expect(expectAaveWethBalance).to.be.equal(await contracts.weth.balanceOf(contracts.aaveLendPool.address));
    assertAlmostEqualTol(
      expectBendCollectorBWethBalance,
      await contracts.bWETH.balanceOf(contracts.bendCollector.address),
      0.01
    );
    expect(expectBuyerWethBalance).to.be.equal(await contracts.weth.balanceOf(buyer.address));
  }

  async function approveBuyerWeth() {
    waitForTx(await contracts.weth.connect(buyer).approve(contracts.punkAdapter.address, constants.MaxUint256));
  }

  async function approveBuyerDebtWeth() {
    waitForTx(
      await contracts.debtWETH.connect(buyer).approveDelegation(contracts.punkAdapter.address, constants.MaxUint256)
    );
  }

  function exceptDownpayment(price: BigNumber, borrowAmount: BigNumber) {
    const dataWithSig = createSignedFlashloanParams(
      buyer,
      env.chainId,
      nonce,
      contracts.punkAdapter.address,
      tokenId,
      price
    );
    return expect(
      contracts.downpayment
        .connect(buyer)
        .buy(contracts.punkAdapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    );
  }

  it("Order price must be same", async () => {
    await exceptDownpayment(parseEther("9.9"), borrowAmount).to.revertedWith("Adapter: order price must be same");
  });

  it("WETH Insufficient", async () => {
    await exceptDownpayment(sellPrice, borrowAmount).to.revertedWith("Adapter: WETH Insufficient");
  });

  it("Should approve WETH and debtWETH", async () => {
    await approveBuyerWeth();
    // no debt weth approvement
    await exceptDownpayment(sellPrice, borrowAmount).to.revertedWith("503");
    await approveBuyerDebtWeth();
    await exceptDownpaymentSuccessed(sellPrice, borrowAmount);
  });
});
