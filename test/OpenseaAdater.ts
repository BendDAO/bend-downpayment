/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "./_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { findPrivateKey } from "./helpers/hardhat-keys";
import { waitForTx } from "../tasks/utils/helpers";
import { assertAlmostEqualTol } from "./helpers/equals";
import {
  buildAtomicMatchParams,
  buildFlashloanParams,
  createSellOrder,
  encodeFlashLoanParams,
  makeBuyOrder,
  Order,
  signFlashLoanParams,
  signOrder,
} from "./opensea";
import { getParams, OpenseaExchange } from "./config";
import { network } from "hardhat";
import { IERC721, IOpenseaExchage, MintableERC721, OpenseaAdapter } from "../typechain";
import { latest } from "./helpers/block-traveller";
import { Asset } from "opensea-js/lib/types";
const { parseEther } = utils;

export const NULL_BLOCK_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

makeSuite("OpenseaAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: number;
  let nft: MintableERC721;
  let bnft: IERC721;
  let sellPrice: BigNumber;
  let borrowAmount: BigNumber;
  let nonce: BigNumber;
  let openseaBuyerNonce: BigNumber;
  let openseaSellerNonce: BigNumber;
  let openseaExchange: IOpenseaExchage;
  let merkleValidator: string;
  let tokenTransferProxy: string;
  let adapter: OpenseaAdapter;
  let now: BigNumber;
  let nftAsset: Asset;

  before(async () => {
    now = BigNumber.from(await latest());
    buyer = env.accounts[1];
    seller = env.accounts[2];
    nft = contracts.bayc;
    bnft = contracts.bBAYC;
    tokenId = 7210;
    const config = getParams(OpenseaExchange, network.name);
    adapter = contracts.openseaAdapter;
    openseaExchange = contracts.openseaExchange;
    merkleValidator = config[1];
    tokenTransferProxy = await contracts.openseaExchange.tokenTransferProxy();
    sellPrice = parseEther("10");

    nftAsset = { tokenId: tokenId.toString(), tokenAddress: nft.address };

    waitForTx(await nft.connect(seller).mint(tokenId));

    nonce = await contracts.downpayment.nonces(buyer.address);
    openseaSellerNonce = await openseaExchange.nonces(seller.address);
    openseaBuyerNonce = await openseaExchange.nonces(buyer.address);
    waitForTx(await contracts.proxyRegistry.connect(seller).registerProxy());

    waitForTx(await nft.connect(seller).approve(await contracts.proxyRegistry.proxies(seller.address), tokenId));
    waitForTx(await contracts.weth.connect(seller).approve(tokenTransferProxy, constants.MaxUint256));

    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(nft.address, contracts.weth.address);
    borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function exceptDownpaymentSuccessed(sellOrder: Order, buyOrder: Order, borrowAmount: BigNumber) {
    const aaveFee = borrowAmount.mul(9).div(10000);
    const bendFee = buyOrder.basePrice.mul(env.fee).div(10000);
    const paymentAmount = buyOrder.basePrice.add(aaveFee).add(bendFee).sub(borrowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorBWethBalance = (await contracts.bWETH.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);

    const sellSig = signOrder(findPrivateKey(seller.address), sellOrder, env.chainId, openseaSellerNonce.toNumber());

    const buySig = signFlashLoanParams(
      findPrivateKey(buyer.address),
      env.chainId,
      nonce.toString(),
      adapter.address,
      nft.address,
      tokenId.toString(),
      buyOrder,
      sellOrder,
      sellSig,
      NULL_BLOCK_HASH
    );

    const data = encodeFlashLoanParams(
      buildFlashloanParams(nft.address, tokenId, buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH)
    );
    waitForTx(await contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, data));

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
    await contracts.weth.connect(buyer).approve(adapter.address, constants.MaxUint256);
  }

  async function approveBuyerDebtWeth() {
    await contracts.debtWETH.connect(buyer).approveDelegation(adapter.address, constants.MaxUint256);
  }

  function exceptDownpayment(sellOrder: Order, buyOrder: Order, borrowAmount: BigNumber) {
    const sellSig = signOrder(findPrivateKey(seller.address), sellOrder, env.chainId, openseaSellerNonce.toNumber());
    const buySig = signFlashLoanParams(
      findPrivateKey(buyer.address),
      env.chainId,
      nonce.toString(),
      adapter.address,
      nft.address,
      tokenId.toString(),
      buyOrder,
      sellOrder,
      sellSig,
      NULL_BLOCK_HASH
    );
    const data = encodeFlashLoanParams(
      buildFlashloanParams(nft.address, tokenId, buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH)
    );

    return expect(contracts.downpayment.connect(buyer).buy(adapter.address, borrowAmount, data));
  }

  it("opensea match sell order with ETH", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    const sellSig = signOrder(findPrivateKey(seller.address), sellOrder, env.chainId, openseaSellerNonce.toNumber());
    const buyOrder = makeBuyOrder(sellOrder, buyer.address, env.admin.address, sellOrder.listingTime);
    const buySig = signOrder(findPrivateKey(buyer.address), buyOrder, env.chainId, openseaBuyerNonce.toNumber());
    const params = buildAtomicMatchParams(buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH);
    waitForTx(
      await openseaExchange
        .connect(buyer)
        .atomicMatch_(
          params.addrs,
          params.uints,
          params.feeMethodsSidesKindsHowToCalls,
          params.calldataBuy,
          params.calldataSell,
          params.replacementPatternBuy,
          params.replacementPatternSell,
          params.staticExtradataBuy,
          params.staticExtradataSell,
          params.vs,
          params.rssMetadata,
          { value: sellPrice }
        )
    );
    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("opensea match sell order with WETH", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    sellOrder.paymentToken = contracts.weth.address;
    const sellSig = signOrder(findPrivateKey(seller.address), sellOrder, env.chainId, openseaSellerNonce.toNumber());
    const buyOrder = makeBuyOrder(sellOrder, buyer.address, env.admin.address, sellOrder.listingTime);
    const buySig = signOrder(findPrivateKey(buyer.address), buyOrder, env.chainId, openseaBuyerNonce.toNumber());
    const params = buildAtomicMatchParams(buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH);
    waitForTx(await contracts.weth.connect(buyer).approve(tokenTransferProxy, constants.MaxUint256));
    waitForTx(
      await openseaExchange
        .connect(buyer)
        .atomicMatch_(
          params.addrs,
          params.uints,
          params.feeMethodsSidesKindsHowToCalls,
          params.calldataBuy,
          params.calldataSell,
          params.replacementPatternBuy,
          params.replacementPatternSell,
          params.staticExtradataBuy,
          params.staticExtradataSell,
          params.vs,
          params.rssMetadata
        )
    );
    expect(await nft.ownerOf(tokenId)).to.be.equal(buyer.address);
  });

  it("Buyer must be this contract", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    const buyOrder = makeBuyOrder(sellOrder, env.accounts[3].address, env.admin.address, sellOrder.listingTime);
    await exceptDownpayment(sellOrder, buyOrder, borrowAmount).to.revertedWith("Buyer must be this contract");
  });
  it("Buyer payment token should be ETH or WETH", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    sellOrder.paymentToken = "0x0000000000000000000000000000000000000001";
    const buyOrder = makeBuyOrder(sellOrder, adapter.address, env.admin.address, sellOrder.listingTime);
    await exceptDownpayment(sellOrder, buyOrder, borrowAmount).to.revertedWith(
      "Buyer payment token should be ETH or WETH"
    );
  });
  it("Order must be fixed price sale kind", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    sellOrder.saleKind = 1;
    const buyOrder = makeBuyOrder(sellOrder, adapter.address, env.admin.address, sellOrder.listingTime);
    await exceptDownpayment(sellOrder, buyOrder, borrowAmount).to.revertedWith("Order must be fixed price sale kind");
  });
  it("Order price must be same", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    const buyOrder = makeBuyOrder(sellOrder, adapter.address, env.admin.address, sellOrder.listingTime);
    buyOrder.basePrice = buyOrder.basePrice.sub(parseEther("1"));
    await exceptDownpayment(sellOrder, buyOrder, borrowAmount).to.revertedWith("Order price must be same");
  });
  it("Insufficient balance", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    const buyOrder = makeBuyOrder(sellOrder, adapter.address, env.admin.address, sellOrder.listingTime);
    await exceptDownpayment(sellOrder, buyOrder, borrowAmount).to.revertedWith("Insufficient balance");
  });
  it("Should approve WETH and debtWETH", async () => {
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    const buyOrder = makeBuyOrder(sellOrder, adapter.address, env.admin.address, sellOrder.listingTime);

    await approveBuyerWeth();
    // no debt weth approvement
    await exceptDownpayment(sellOrder, buyOrder, borrowAmount).to.revertedWith("503");
    await approveBuyerDebtWeth();
    await exceptDownpaymentSuccessed(sellOrder, buyOrder, borrowAmount);
  });

  it("Sell order with WETH", async () => {
    await approveBuyerWeth();
    await approveBuyerDebtWeth();
    const sellOrder = createSellOrder(
      openseaExchange.address,
      nftAsset,
      seller.address,
      sellPrice,
      now,
      merkleValidator,
      env.admin.address
    );
    sellOrder.paymentToken = contracts.weth.address;
    const buyOrder = makeBuyOrder(sellOrder, adapter.address, env.admin.address, sellOrder.listingTime);
    await exceptDownpaymentSuccessed(sellOrder, buyOrder, borrowAmount);
  });
});
