/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { waitForTx } from "../../tasks/utils/helpers";
import { assertAlmostEqualTol } from "../helpers/equals";
import { createOrder, createRunput, createSignedFlashloanParams } from "../signer/x2y2";
import { IERC721, IWETH, IX2Y2, MintableERC721, X2Y2Adapter } from "../../typechain-types";
import { latest } from "../helpers/block-traveller";
import { getParams, X2Y2 } from "../config";
import { network, ethers } from "hardhat";
import { RunInput } from "@x2y2-io/sdk/src/types";

const { parseEther } = utils;

makeSuite("X2Y2Adapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: number;
  let nft: MintableERC721;
  let bnft: IERC721;
  let sellPrice: BigNumber;
  let borrowAmount: BigNumber;
  let adapterNonce: BigNumber;
  let exchange: IX2Y2;
  let adapter: X2Y2Adapter;
  let now: BigNumber;
  let erc721Delegate: string;
  let exchangeOwner: string;
  let weth: IWETH;

  before(async () => {
    now = BigNumber.from(await latest());
    buyer = env.accounts[1];
    seller = env.accounts[2];
    nft = contracts.bayc;
    bnft = contracts.bBAYC;
    tokenId = 7211;

    adapter = contracts.x2y2Adapter;
    exchange = contracts.x2y2Exchange;
    erc721Delegate = getParams(X2Y2, network.name)[1];
    exchangeOwner = getParams(X2Y2, network.name)[2];
    weth = contracts.weth;

    sellPrice = parseEther("10");

    waitForTx(await nft.connect(seller).mint(tokenId));

    adapterNonce = await contracts.downpayment.nonces(buyer.address);

    waitForTx(await nft.connect(seller).approve(erc721Delegate, tokenId));

    waitForTx(await contracts.weth.connect(buyer).approve(exchange.address, constants.MaxUint256));

    // add new run input signer
    waitForTx(
      await exchange.connect(await ethers.getImpersonatedSigner(exchangeOwner)).updateSigners([env.admin.address], [])
    );

    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address);
    borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function approveBuyerWeth() {
    await contracts.weth.connect(buyer).approve(adapter.address, constants.MaxUint256);
  }

  async function approveBuyerDebtWeth() {
    await contracts.debtWETH.connect(buyer).approveDelegation(adapter.address, constants.MaxUint256);
  }

  async function exceptDownpaymentSuccessed(input: RunInput, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const orderPrice = BigNumber.from(input.details[0].price);
    const bendFee = orderPrice.mul(env.fee).div(10000);
    const paymentAmount = orderPrice.add(aaveFee).add(bendFee).sub(borrowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorBWethBalance = (await contracts.bWETH.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);

    const dataWithsig = await createSignedFlashloanParams(
      env.chainId,
      buyer.address,
      adapter.address,
      input,
      adapterNonce
    );

    waitForTx(
      await contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithsig.data, dataWithsig.sig)
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

  async function exceptDownpayment(input: RunInput, borrowAmount: BigNumber) {
    const dataWithsig = await createSignedFlashloanParams(
      env.chainId,
      buyer.address,
      adapter.address,
      input,
      adapterNonce
    );

    return expect(
      contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithsig.data, dataWithsig.sig)
    );
  }

  it("match order with ETH", async () => {
    const order = await createOrder({
      chainId: env.chainId,
      signer: seller,
      tokenAddress: nft.address,
      tokenId: tokenId,
      price: sellPrice,
      currency: constants.AddressZero,
      expirationTime: now.add(500),
    });
    const input = await createRunput(env.admin.address, erc721Delegate, order, buyer.address, []);
    waitForTx(await exchange.connect(buyer).run(input, { value: sellPrice }));
    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("match order with WETH", async () => {
    const order = await createOrder({
      chainId: env.chainId,
      signer: seller,
      tokenAddress: nft.address,
      tokenId: tokenId,
      price: sellPrice,
      currency: weth.address,
      expirationTime: now.add(500),
    });
    const input = await createRunput(env.admin.address, erc721Delegate, order, buyer.address, []);
    waitForTx(await exchange.connect(buyer).run(input));
    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("currency should be ETH or WETH", async () => {
    const order = await createOrder({
      chainId: env.chainId,
      signer: seller,
      tokenAddress: nft.address,
      tokenId: tokenId,
      price: sellPrice,
      currency: "0x0000000000000000000000000000000000000001",
      expirationTime: now.add(500),
    });
    const input = await createRunput(env.admin.address, erc721Delegate, order, adapter.address, []);

    await (await exceptDownpayment(input, borrowAmount)).to.revertedWith("Adapter: currency should be ETH or WETH");
  });

  it("downpayment buy with WETH", async () => {
    await approveBuyerWeth();
    await approveBuyerDebtWeth();
    const order = await createOrder({
      chainId: env.chainId,
      signer: seller,
      tokenAddress: nft.address,
      tokenId: tokenId,
      price: sellPrice,
      currency: weth.address,
      expirationTime: now.add(500),
    });
    const input = await createRunput(env.admin.address, erc721Delegate, order, adapter.address, []);
    await exceptDownpaymentSuccessed(input, borrowAmount);
  });
});
