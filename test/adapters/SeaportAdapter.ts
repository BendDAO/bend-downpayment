/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { waitForTx } from "../../tasks/utils/helpers";
import {
  createSignedFlashloanParams,
  signOrder,
  OrderParameters,
  ItemType,
  OrderType,
  createOrder,
} from "../signer/seaport";
import { IERC721, ISeaport, MintableERC721, SeaportAdapter } from "../../typechain-types";
import { latest } from "../helpers/block-traveller";
import { getParams, Seaport15 } from "../config";
import { network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MaxUint256, parseEther } from "ethers";

makeSuite("SeaportAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: number;
  let nft: MintableERC721;
  let bnft: IERC721;
  let sellPrice: bigint;
  let borrowAmount: bigint;
  let adapterNonce: bigint;
  let exchangeNonce: bigint;
  let exchange: ISeaport;
  let adapter: SeaportAdapter;
  let now: bigint;
  let conduitKey: string;
  let conduitAddress: string;

  before(async () => {
    now = await latest();
    buyer = env.accounts[1];
    seller = env.accounts[2];
    nft = contracts.bayc;
    bnft = contracts.bBAYC;
    tokenId = 7211;

    adapter = contracts.seaportAdapter;
    exchange = contracts.seaportExchange;
    sellPrice = parseEther("10");
    conduitKey = getParams(Seaport15, network.name)[1];
    conduitAddress = getParams(Seaport15, network.name)[2];

    waitForTx(await nft.connect(seller).mint(tokenId));

    adapterNonce = await contracts.downpayment.nonces(buyer.getAddress());
    exchangeNonce = await exchange.getCounter(seller.getAddress());

    waitForTx(await nft.connect(seller).approve(conduitAddress, tokenId));

    waitForTx(await contracts.weth.connect(buyer).approve(conduitAddress, MaxUint256));

    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(
      nft.getAddress(),
      contracts.weth.getAddress()
    );
    borrowAmount = nftCollateralData.availableBorrowsInReserve - 1n;
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function exceptDownpaymentSuccessed(order: OrderParameters, borrowAmount: bigint) {
    const aaveFee = (borrowAmount * 9n) / 10000n;
    const orderPrice = order.consideration.map((i) => BigInt(i.startAmount)).reduce((p, n) => p + n);
    const bendFee = (orderPrice * env.fee) / 10000n;
    const paymentAmount = orderPrice + aaveFee + bendFee - borrowAmount;
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.getAddress())) + aaveFee;

    const expectBendCollectorWethBalance =
      (await contracts.weth.balanceOf(contracts.bendCollector.getAddress())) + bendFee;
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.getAddress())) - paymentAmount;

    const signedOrder = await signOrder(
      env.chainId,
      seller,
      await exchange.getAddress(),
      order,
      conduitKey,
      exchangeNonce
    );

    const dataWithSig = await createSignedFlashloanParams(
      env.chainId,
      buyer,
      await adapter.getAddress(),
      signedOrder,
      adapterNonce
    );
    waitForTx(
      await contracts.downpayment
        .connect(buyer)
        .buy(adapter.getAddress(), borrowAmount, dataWithSig.data, dataWithSig.sig)
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(await bnft.getAddress());
    expect(await bnft.ownerOf(tokenId)).to.be.equal(await buyer.getAddress());

    expect(expectAaveWethBalance).to.be.equal(await contracts.weth.balanceOf(contracts.aaveLendPool.getAddress()));
    expect(expectBendCollectorWethBalance).closeTo(
      await contracts.weth.balanceOf(contracts.bendCollector.getAddress()),
      10
    );
    expect(expectBuyerWethBalance).to.be.equal(await contracts.weth.balanceOf(buyer.getAddress()));
  }

  async function approveBuyerWeth() {
    await contracts.weth.connect(buyer).approve(adapter.getAddress(), MaxUint256);
  }

  async function approveBuyerDebtWeth() {
    await contracts.debtWETH.connect(buyer).approveDelegation(adapter.getAddress(), MaxUint256);
  }

  async function exceptDownpayment(order: OrderParameters, borrowAmount: bigint) {
    const signedOrder = await signOrder(
      env.chainId,
      seller,
      await exchange.getAddress(),
      order,
      conduitKey,
      exchangeNonce
    );
    const dataWithSig = await createSignedFlashloanParams(
      env.chainId,
      buyer,
      await adapter.getAddress(),
      signedOrder,
      adapterNonce
    );

    return expect(
      contracts.downpayment.connect(buyer).buy(adapter.getAddress(), borrowAmount, dataWithSig.data, dataWithSig.sig)
    );
  }

  it("seaport fulfill order with ETH", async () => {
    const order = await createOrder({
      offerer: await seller.getAddress(),
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now + 1000n,
      offer: {
        itemType: ItemType.ERC721,
        token: await nft.getAddress(),
        identifier: tokenId.toString(),
      },
      consideration: {
        amount: sellPrice.toString(),
        recipient: await seller.getAddress(),
      },
      fees: [],
      nonce: exchangeNonce,
    });
    const signedOrder = await signOrder(
      env.chainId,
      seller,
      await exchange.getAddress(),
      order,
      conduitKey,
      exchangeNonce
    );
    await expect(exchange.connect(buyer).fulfillBasicOrder(signedOrder, { value: sellPrice })).to.emit(
      exchange,
      "OrderFulfilled"
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(await buyer.getAddress());
  });

  it("seaport fulfill order with WETH", async () => {
    const order = await createOrder({
      offerer: await seller.getAddress(),
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now + 1000n,
      offer: {
        itemType: ItemType.ERC721,
        token: await nft.getAddress(),
        identifier: tokenId.toString(),
      },
      consideration: {
        token: await contracts.weth.getAddress(),
        amount: sellPrice.toString(),
        recipient: await seller.getAddress(),
      },
      fees: [],
      nonce: exchangeNonce,
    });
    const signedOrder = await signOrder(
      env.chainId,
      seller,
      await exchange.getAddress(),
      order,
      conduitKey,
      exchangeNonce
    );

    await expect(exchange.connect(buyer).fulfillBasicOrder(signedOrder)).to.emit(exchange, "OrderFulfilled");
    expect(await nft.ownerOf(tokenId)).to.be.equal(await buyer.getAddress());
  });

  it("currency should be ETH or WETH", async () => {
    const order = await createOrder({
      offerer: await seller.getAddress(),
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now + 1000n,
      offer: {
        itemType: ItemType.ERC721,
        token: await nft.getAddress(),
        identifier: tokenId.toString(),
      },
      consideration: {
        token: "0x0000000000000000000000000000000000000001",
        amount: sellPrice.toString(),
        recipient: await seller.getAddress(),
      },
      fees: [],
      nonce: exchangeNonce,
    });
    await (await exceptDownpayment(order, borrowAmount)).to.revertedWith("Adapter: currency should be ETH or WETH");
  });

  it("downpayment buy with WETH", async () => {
    await approveBuyerWeth();
    await approveBuyerDebtWeth();
    const order = await createOrder({
      offerer: await seller.getAddress(),
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now + 1000n,
      offer: {
        itemType: ItemType.ERC721,
        token: await nft.getAddress(),
        identifier: tokenId.toString(),
      },
      consideration: {
        token: await contracts.weth.getAddress(),
        amount: sellPrice.toString(),
        recipient: await seller.getAddress(),
      },
      fees: [
        {
          basisPoints: 200,
          recipient: await env.accounts[3].getAddress(),
        },
        {
          basisPoints: 500,
          recipient: await env.accounts[4].getAddress(),
        },
      ],
      nonce: exchangeNonce,
    });
    await exceptDownpaymentSuccessed(order, borrowAmount);
  });
});
