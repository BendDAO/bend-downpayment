/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "../_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { waitForTx } from "../../tasks/utils/helpers";
import { assertAlmostEqualTol } from "../helpers/equals";
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

const { parseEther } = utils;

makeSuite("SeaportAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: number;
  let nft: MintableERC721;
  let bnft: IERC721;
  let sellPrice: BigNumber;
  let borrowAmount: BigNumber;
  let adapterNonce: BigNumber;
  let exchangeNonce: BigNumber;
  let exchange: ISeaport;
  let adapter: SeaportAdapter;
  let now: BigNumber;
  let conduitKey: string;
  let conduitAddress: string;

  before(async () => {
    now = BigNumber.from(await latest());
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

    adapterNonce = await contracts.downpayment.nonces(buyer.address);
    exchangeNonce = await exchange.getCounter(seller.address);

    waitForTx(await nft.connect(seller).approve(conduitAddress, tokenId));

    waitForTx(await contracts.weth.connect(buyer).approve(conduitAddress, constants.MaxUint256));

    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address);
    borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function exceptDownpaymentSuccessed(order: OrderParameters, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const orderPrice = order.consideration.map((i) => BigNumber.from(i.startAmount)).reduce((p, n) => p.add(n));
    const bendFee = orderPrice.mul(env.fee).div(10000);
    const paymentAmount = orderPrice.add(aaveFee).add(bendFee).sub(borrowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorWethBalance = (await contracts.weth.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);

    const signedOrder = await signOrder(
      env.chainId,
      seller.address,
      exchange.address,
      order,
      conduitKey,
      exchangeNonce
    );
    const dataWithSig = await createSignedFlashloanParams(
      env.chainId,
      buyer.address,
      adapter.address,
      signedOrder,
      adapterNonce
    );
    waitForTx(
      await contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(bnft.address);
    expect(await bnft.ownerOf(tokenId)).to.be.equal(buyer.address);

    expect(expectAaveWethBalance).to.be.equal(await contracts.weth.balanceOf(contracts.aaveLendPool.address));
    assertAlmostEqualTol(
      expectBendCollectorWethBalance,
      await contracts.weth.balanceOf(contracts.bendCollector.address),
      0.01
    );
    expect(expectBuyerWethBalance).to.be.equal(await contracts.weth.balanceOf(buyer.address));
  }

  async function exceptDownpaymentOnBehalfOfSuccessed(order: OrderParameters, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const orderPrice = order.consideration.map((i) => BigNumber.from(i.startAmount)).reduce((p, n) => p.add(n));
    const bendFee = orderPrice.mul(env.fee).div(10000);
    const paymentAmount = orderPrice.add(aaveFee).add(bendFee).sub(borrowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorWethBalance = (await contracts.weth.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);

    const signedOrder = await signOrder(
      env.chainId,
      seller.address,
      exchange.address,
      order,
      conduitKey,
      exchangeNonce
    );
    const dataWithSig = await createSignedFlashloanParams(
      env.chainId,
      buyer.address,
      adapter.address,
      signedOrder,
      adapterNonce
    );
    waitForTx(
      await contracts.downpayment
        .connect(buyer)
        .buyOnBehalfOf(adapter.address, borrowAmount, buyer.address, dataWithSig.data, dataWithSig.sig)
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(bnft.address);
    expect(await bnft.ownerOf(tokenId)).to.be.equal(buyer.address);

    expect(expectAaveWethBalance).to.be.equal(await contracts.weth.balanceOf(contracts.aaveLendPool.address));
    assertAlmostEqualTol(
      expectBendCollectorWethBalance,
      await contracts.weth.balanceOf(contracts.bendCollector.address),
      0.01
    );
    expect(expectBuyerWethBalance).to.be.equal(await contracts.weth.balanceOf(buyer.address));
  }

  async function approveBuyerWeth() {
    await contracts.weth.connect(buyer).approve(adapter.address, constants.MaxUint256);
  }

  async function approveBuyerDebtWeth() {
    await contracts.debtWETH.connect(buyer).approveDelegation(adapter.address, constants.MaxUint256);
  }

  async function exceptDownpayment(order: OrderParameters, borrowAmount: BigNumber) {
    const signedOrder = await signOrder(
      env.chainId,
      seller.address,
      exchange.address,
      order,
      conduitKey,
      exchangeNonce
    );
    const dataWithSig = await createSignedFlashloanParams(
      env.chainId,
      buyer.address,
      adapter.address,
      signedOrder,
      adapterNonce
    );

    return expect(
      contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, dataWithSig.data, dataWithSig.sig)
    );
  }

  it("seaport fulfill order with ETH", async () => {
    const order = await createOrder({
      offerer: seller.address,
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now.add(1000),
      offer: {
        itemType: ItemType.ERC721,
        token: nft.address,
        identifier: tokenId.toString(),
      },
      consideration: {
        amount: sellPrice.toString(),
        recipient: seller.address,
      },
      fees: [],
      nonce: exchangeNonce,
    });
    const signedOrder = await signOrder(
      env.chainId,
      seller.address,
      exchange.address,
      order,
      conduitKey,
      exchangeNonce
    );
    await expect(exchange.connect(buyer).fulfillBasicOrder(signedOrder, { value: sellPrice })).to.emit(
      exchange,
      "OrderFulfilled"
    );

    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("seaport fulfill order with WETH", async () => {
    const order = await createOrder({
      offerer: seller.address,
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now.add(1000),
      offer: {
        itemType: ItemType.ERC721,
        token: nft.address,
        identifier: tokenId.toString(),
      },
      consideration: {
        token: contracts.weth.address,
        amount: sellPrice.toString(),
        recipient: seller.address,
      },
      fees: [],
      nonce: exchangeNonce,
    });
    const signedOrder = await signOrder(
      env.chainId,
      seller.address,
      exchange.address,
      order,
      conduitKey,
      exchangeNonce
    );

    await expect(exchange.connect(buyer).fulfillBasicOrder(signedOrder)).to.emit(exchange, "OrderFulfilled");
    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("currency should be ETH or WETH", async () => {
    const order = await createOrder({
      offerer: seller.address,
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now.add(1000),
      offer: {
        itemType: ItemType.ERC721,
        token: nft.address,
        identifier: tokenId.toString(),
      },
      consideration: {
        token: "0x0000000000000000000000000000000000000001",
        amount: sellPrice.toString(),
        recipient: seller.address,
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
      offerer: seller.address,
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now.add(1000),
      offer: {
        itemType: ItemType.ERC721,
        token: nft.address,
        identifier: tokenId.toString(),
      },
      consideration: {
        token: contracts.weth.address,
        amount: sellPrice.toString(),
        recipient: seller.address,
      },
      fees: [
        {
          basisPoints: 200,
          recipient: env.accounts[3].address,
        },
        {
          basisPoints: 500,
          recipient: env.accounts[4].address,
        },
      ],
      nonce: exchangeNonce,
    });
    await exceptDownpaymentSuccessed(order, borrowAmount);
  });

  it("downpayment buy on behalf of", async () => {
    await approveBuyerWeth();
    await approveBuyerDebtWeth();
    const order = await createOrder({
      offerer: seller.address,
      conduitKey: conduitKey,
      orderType: OrderType.FULL_OPEN,
      startTime: now,
      endTime: now.add(1000),
      offer: {
        itemType: ItemType.ERC721,
        token: nft.address,
        identifier: tokenId.toString(),
      },
      consideration: {
        token: contracts.weth.address,
        amount: sellPrice.toString(),
        recipient: seller.address,
      },
      fees: [
        {
          basisPoints: 200,
          recipient: env.accounts[3].address,
        },
        {
          basisPoints: 500,
          recipient: env.accounts[4].address,
        },
      ],
      nonce: exchangeNonce,
    });
    await exceptDownpaymentOnBehalfOfSuccessed(order, borrowAmount);
  });
});
