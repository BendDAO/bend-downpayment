/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { BigNumber, Contract, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { waitForTx } from "../../tasks/utils/helpers";

import { BendExchange, getParams } from "../config";
import { ethers, network } from "hardhat";
import { BendExchangeAdapter, IAuthorizationManager, IERC20, IERC721, MintableERC721 } from "../../typechain-types";
import { createSignedFlashloanParams, createSignedMakerOrder, createTakerOrder } from "../signer/bend";
import { parseUnits } from "ethers/lib/utils";
const { parseEther, defaultAbiCoder } = utils;
const emptyEncodedBytes = defaultAbiCoder.encode([], []);

makeSuite("BendExchangeAdapterV2", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: BigNumber;
  let nft: MintableERC721;
  let bnft: IERC721;
  let nonce: BigNumber;
  let adapter: BendExchangeAdapter;
  let authorizationManager: IAuthorizationManager;
  let strategy: string;
  let startTimeOrder: BigNumber;
  let endTimeOrder: BigNumber;
  let sellerNonce: BigNumber;

  before(async () => {
    startTimeOrder = BigNumber.from((await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp);
    endTimeOrder = startTimeOrder.add(1000);
    seller = env.accounts[1];
    buyer = env.accounts[2];
    nft = contracts.bayc;
    bnft = contracts.bBAYC;
    tokenId = BigNumber.from(7211);
    const config = getParams(BendExchange, network.name);
    strategy = config[1];
    adapter = contracts.bendExchangeAdapterV2;
    authorizationManager = contracts.authorizationManager;

    waitForTx(await nft.connect(seller).mint(tokenId));
    expect(await nft.ownerOf(tokenId)).to.be.eq(seller.address);

    nonce = await contracts.downpayment.nonces(buyer.address);
    sellerNonce = BigNumber.from(100);

    waitForTx(await authorizationManager.connect(seller).registerProxy());
    waitForTx(await authorizationManager.connect(buyer).registerProxy());

    const sellerProxy = await authorizationManager.proxies(seller.address);
    const buyerProxy = await authorizationManager.proxies(buyer.address);

    waitForTx(await nft.connect(seller).setApprovalForAll(sellerProxy, true));

    waitForTx(await contracts.weth.connect(buyer).approve(buyerProxy, constants.MaxUint256));
    waitForTx(await contracts.usdt.connect(buyer).approve(buyerProxy, constants.MaxUint256));

    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  const getContract = async <ContractType extends Contract>(
    contractName: string,
    address: string
  ): Promise<ContractType> => (await ethers.getContractAt(contractName, address)) as ContractType;

  async function exceptDownpaymentSuccessed(price: BigNumber, currency: string, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const bendFee = price.mul(env.fee).div(10000);
    const paymentAmount = price.add(aaveFee).add(bendFee).sub(borrowAmount);
    const currencyERC20 =
      currency === constants.AddressZero ? contracts.weth : await getContract<IERC20>("IERC20", currency);
    const expectAaveBalance = (await currencyERC20.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorBalance = (await currencyERC20.balanceOf(contracts.bendCollector.address)).add(bendFee);
    const expectBuyerBalance = (await currencyERC20.balanceOf(buyer.address)).sub(paymentAmount);

    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: true,
        maker: seller.address,
        interceptor: constants.AddressZero,
        interceptorExtra: emptyEncodedBytes,
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
        verifyingContract: contracts.bendExchange.address,
      },
      adapter.address,
      nonce
    );
    if (currency === contracts.weth.address || currency === constants.AddressZero) {
      waitForTx(
        await contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
      );
    } else {
      waitForTx(
        await contracts.downpayment
          .connect(buyer)
          .buyWithERC20(adapter.address, currency, borrowAmount, dataWithSig.data, dataWithSig.sig)
      );
    }

    expect(await nft.ownerOf(tokenId)).to.be.equal(bnft.address);
    expect(await bnft.ownerOf(tokenId)).to.be.equal(buyer.address);

    expect(expectAaveBalance).closeTo(await currencyERC20.balanceOf(contracts.aaveLendPool.address), 2);
    expect(expectBendCollectorBalance).closeTo(await currencyERC20.balanceOf(contracts.bendCollector.address), 2);
    expect(expectBuyerBalance).closeTo(await currencyERC20.balanceOf(buyer.address), 2);
  }

  async function approveBuyerWeth() {
    waitForTx(await contracts.weth.connect(buyer).approve(adapter.address, constants.MaxUint256));
  }

  async function approveBuyerDebtWeth() {
    waitForTx(await contracts.debtWETH.connect(buyer).approveDelegation(adapter.address, constants.MaxUint256));
  }

  async function approveBuyerUsdt() {
    waitForTx(await contracts.usdt.connect(buyer).approve(adapter.address, 0));
    waitForTx(await contracts.usdt.connect(buyer).approve(adapter.address, constants.MaxUint256));
  }

  async function approveBuyerDebtUsdt() {
    waitForTx(await contracts.debtUSDT.connect(buyer).approveDelegation(adapter.address, constants.MaxUint256));
  }

  it("BendExchange match order", async () => {
    const price = parseEther("10");
    const makerAskOrder = await createSignedMakerOrder({
      isOrderAsk: true,
      maker: seller.address,
      collection: nft.address,
      price: price,
      tokenId: tokenId,
      amount: constants.One,
      strategy: strategy,
      currency: constants.AddressZero,
      nonce: sellerNonce,
      startTime: startTimeOrder,
      endTime: endTimeOrder,
      minPercentageToAsk: constants.Zero,
      params: emptyEncodedBytes,
      interceptor: constants.AddressZero,
      interceptorExtra: emptyEncodedBytes,
      signerUser: seller.address,
      chainId: env.chainId,
      verifyingContract: contracts.bendExchange.address,
    });
    const takerBidOrder = createTakerOrder({
      isOrderAsk: false,
      taker: buyer.address,
      price: price,
      tokenId: tokenId,
      minPercentageToAsk: constants.Zero,
      params: emptyEncodedBytes,
      interceptor: constants.AddressZero,
      interceptorExtra: emptyEncodedBytes,
    });
    waitForTx(
      await contracts.bendExchange.connect(buyer).matchAskWithTakerBidUsingETHAndWETH(takerBidOrder, makerAskOrder, {
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
        interceptor: constants.AddressZero,
        interceptorExtra: emptyEncodedBytes,
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
        verifyingContract: contracts.bendExchange.address,
      },

      adapter.address,
      nonce
    );
    const borrowAmount = (
      await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address)
    ).availableBorrowsInReserve.sub(1);
    await expect(
      contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    ).to.revertedWith("Adapter: maker must ask order");
  });

  it("Should approve WETH and debtWETH", async () => {
    const borrowAmount = (await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address))
      .availableBorrowsInReserve;
    const price = borrowAmount.add(parseEther("10"));
    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: true,
        maker: seller.address,
        interceptor: constants.AddressZero,
        interceptorExtra: emptyEncodedBytes,
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
        verifyingContract: contracts.bendExchange.address,
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
    await exceptDownpaymentSuccessed(price, constants.AddressZero, borrowAmount);
  });

  it("Sell order with ETH", async () => {
    await approveBuyerWeth();
    await approveBuyerDebtWeth();
    const borrowAmount = (await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address))
      .availableBorrowsInReserve;
    const price = borrowAmount.add(parseEther("10"));
    await exceptDownpaymentSuccessed(price, constants.AddressZero, borrowAmount);
  });

  it("Sell order with WETH", async () => {
    await approveBuyerWeth();
    await approveBuyerDebtWeth();
    const borrowAmount = (await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address))
      .availableBorrowsInReserve;
    const price = borrowAmount.add(parseEther("10"));
    await exceptDownpaymentSuccessed(price, contracts.weth.address, borrowAmount);
  });

  it("Should approve usdt and debtUSDT", async () => {
    const borrowAmount = (await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.usdt.address))
      .availableBorrowsInReserve;
    const price = borrowAmount.add(parseUnits("10", 6));
    const dataWithSig = await createSignedFlashloanParams(
      buyer.address,
      {
        isOrderAsk: true,
        maker: seller.address,
        interceptor: constants.AddressZero,
        interceptorExtra: emptyEncodedBytes,
        collection: nft.address,
        price,
        tokenId,
        amount: constants.One,
        strategy,
        currency: contracts.usdt.address,
        nonce: sellerNonce,
        startTime: startTimeOrder,
        endTime: endTimeOrder,
        minPercentageToAsk: constants.Zero,
        params: emptyEncodedBytes,
        signerUser: seller.address,
        chainId: env.chainId,
        verifyingContract: contracts.bendExchange.address,
      },
      adapter.address,
      nonce
    );

    await approveBuyerUsdt();
    // no debt weth approvement

    await expect(
      contracts.downpayment
        .connect(buyer)
        .buyWithERC20(adapter.address, contracts.usdt.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    ).to.revertedWith("503");
    await approveBuyerDebtUsdt();
    await exceptDownpaymentSuccessed(price, contracts.usdt.address, borrowAmount);
  });

  it("Sell order with WETH", async () => {
    await approveBuyerUsdt();
    await approveBuyerDebtUsdt();
    const borrowAmount = (await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.usdt.address))
      .availableBorrowsInReserve;
    const price = borrowAmount.add(parseUnits("10", 6));
    await exceptDownpaymentSuccessed(price, contracts.usdt.address, borrowAmount);
  });
});
