/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { waitForTx } from "../../tasks/utils/helpers";
import { assertAlmostEqualTol } from "../helpers/equals";

import { LooksRareExchange, getParams } from "../config";
import { ethers, network } from "hardhat";
import { IERC721, ILooksRareExchange, LooksRareExchangeAdapter, MintableERC721 } from "../../typechain";
import { createSignedFlashloanParams, createSignedMakerOrder, createTakerOrder } from "../signer/looksRare";
const { parseEther, defaultAbiCoder } = utils;
const emptyEncodedBytes = defaultAbiCoder.encode([], []);

makeSuite("LooksRareExchangeAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: BigNumber;
  let nft: MintableERC721;
  let bnft: IERC721;
  let borrowAmount: BigNumber;
  let nonce: BigNumber;
  let adapter: LooksRareExchangeAdapter;
  let strategy: string;
  let startTimeOrder: BigNumber;
  let endTimeOrder: BigNumber;
  let sellerNonce: BigNumber;
  let exchange: ILooksRareExchange;

  before(async () => {
    startTimeOrder = BigNumber.from((await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp);
    endTimeOrder = startTimeOrder.add(1000);
    seller = env.accounts[1];
    buyer = env.accounts[2];
    nft = contracts.bayc;
    bnft = contracts.bBAYC;
    tokenId = BigNumber.from(7211);
    const config = getParams(LooksRareExchange, network.name);
    strategy = config[1];
    adapter = contracts.looksRareExchangeAdapter;
    exchange = contracts.looksRareExchange;

    waitForTx(await nft.connect(seller).mint(tokenId));
    expect(await nft.ownerOf(tokenId)).to.be.eq(seller.address);

    nonce = await contracts.downpayment.nonces(buyer.address);
    sellerNonce = BigNumber.from(100);
    const transferManager = await contracts.transferNFT.checkTransferManagerForToken(nft.address);
    waitForTx(await nft.connect(seller).setApprovalForAll(transferManager, true));

    waitForTx(await contracts.weth.connect(buyer).approve(adapter.address, constants.MaxUint256));

    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address);
    borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function exceptDownpaymentSuccessed(price: BigNumber, currency: string, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const bendFee = price.mul(env.fee).div(10000);
    const paymentAmount = price.add(aaveFee).add(bendFee).sub(borrowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorBWethBalance = (await contracts.bWETH.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);

    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: true,
        maker: seller.address,
        collection: nft.address,
        price,
        tokenId,
        amount: constants.One,
        strategy,
        currency,
        nonce: sellerNonce,
        startTime: startTimeOrder,
        endTime: endTimeOrder,
        minPercentageToAsk: constants.Zero,
        params: emptyEncodedBytes,
        signerUser: seller.address,
        chainId: env.chainId,
        verifyingContract: exchange.address,
      },
      adapter.address,
      nonce
    );
    waitForTx(
      await contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(bnft.address);
    expect(await bnft.ownerOf(tokenId)).to.be.equal(buyer.address);

    expect(expectAaveWethBalance).to.be.equal(await contracts.weth.balanceOf(contracts.aaveLendPool.address));
    assertAlmostEqualTol(
      expectBendCollectorBWethBalance,
      await contracts.bWETH.balanceOf(contracts.bendCollector.address),
      0.01
    );
    expect(expectBuyerWethBalance).to.be.equal(await contracts.weth.balanceOf(buyer.address));
  }

  async function approveBuyerWeth() {
    waitForTx(await contracts.weth.connect(buyer).approve(adapter.address, constants.MaxUint256));
  }

  async function approveBuyerDebtWeth() {
    waitForTx(await contracts.debtWETH.connect(buyer).approveDelegation(adapter.address, constants.MaxUint256));
  }

  it("LooksRareExchange match order", async () => {
    const price = parseEther("10");
    const makerAskOrder = await createSignedMakerOrder({
      isOrderAsk: true,
      maker: seller.address,
      collection: nft.address,
      price: price,
      tokenId: tokenId,
      amount: constants.One,
      strategy: strategy,
      currency: contracts.weth.address,
      nonce: sellerNonce,
      startTime: startTimeOrder,
      endTime: endTimeOrder,
      minPercentageToAsk: constants.Zero,
      params: emptyEncodedBytes,
      signerUser: seller.address,
      chainId: env.chainId,
      verifyingContract: exchange.address,
    });
    const takerBidOrder = createTakerOrder({
      isOrderAsk: false,
      taker: buyer.address,
      price: price,
      tokenId: tokenId,
      minPercentageToAsk: constants.Zero,
      params: emptyEncodedBytes,
    });
    waitForTx(
      await exchange.connect(buyer).matchAskWithTakerBidUsingETHAndWETH(takerBidOrder, makerAskOrder, {
        value: takerBidOrder.price,
      })
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("Maker must ask order", async () => {
    const price = parseEther("10");
    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: false,
        maker: seller.address,
        collection: nft.address,
        price,
        tokenId,
        amount: constants.One,
        strategy,
        currency: contracts.weth.address,
        nonce: sellerNonce,
        startTime: startTimeOrder,
        endTime: endTimeOrder,
        minPercentageToAsk: constants.Zero,
        params: emptyEncodedBytes,
        signerUser: seller.address,
        chainId: env.chainId,
        verifyingContract: exchange.address,
      },

      adapter.address,
      nonce
    );
    await expect(
      contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    ).to.revertedWith("Adapter: maker must ask order");
  });
  it("Currency must be WETH", async () => {
    const price = parseEther("10");
    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: true,
        maker: seller.address,
        collection: nft.address,
        price,
        tokenId,
        amount: constants.One,
        strategy,
        currency: constants.AddressZero,
        nonce: sellerNonce,
        startTime: startTimeOrder,
        endTime: endTimeOrder,
        minPercentageToAsk: constants.Zero,
        params: emptyEncodedBytes,
        signerUser: seller.address,
        chainId: env.chainId,
        verifyingContract: exchange.address,
      },
      adapter.address,
      nonce
    );
    await expect(
      contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    ).to.revertedWith("Adapter: currency must be WETH");
  });

  it("Should approve WETH and debtWETH", async () => {
    const price = parseEther("10");
    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: true,
        maker: seller.address,
        collection: nft.address,
        price,
        tokenId,
        amount: constants.One,
        strategy,
        currency: contracts.weth.address,
        nonce: sellerNonce,
        startTime: startTimeOrder,
        endTime: endTimeOrder,
        minPercentageToAsk: constants.Zero,
        params: emptyEncodedBytes,
        signerUser: seller.address,
        chainId: env.chainId,
        verifyingContract: exchange.address,
      },
      adapter.address,
      nonce
    );

    await approveBuyerWeth();
    // no debt weth approvement
    await expect(
      contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    ).to.revertedWith("503");
    await approveBuyerDebtWeth();
    await exceptDownpaymentSuccessed(price, contracts.weth.address, borrowAmount);
  });
});
