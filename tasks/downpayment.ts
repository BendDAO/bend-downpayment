/* eslint-disable node/no-unsupported-features/es-syntax */
import { BigNumber, constants } from "ethers";
import { defaultAbiCoder, parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { BendExchange, BendProtocol, getParams, PunkMarket, Seaport14, WETH, X2Y2 } from "../test/config";
import {
  Downpayment,
  ERC721,
  IAuthorizationManager,
  IBendExchange,
  ILendPool,
  ILendPoolAddressesProvider,
  ISeaport,
  IWETH,
} from "../typechain-types";
import { getContractFromDB, getContractAddressFromDB, getChainId, getContract, waitForTx } from "./utils/helpers";
import * as bend from "../test/signer/bend";
import * as punk from "../test/signer/punk";
import * as seaport from "../test/signer/seaport";
import { findPrivateKey } from "../test/helpers/hardhat-keys";

import "dotenv/config";
import * as x2y2Sdk from "./x2y2";
// import * as x2y2Api from "./x2y2/api";

task("repay", "repay loan")
  .addParam("sender", "address of sender")
  .addParam("nft", "address of nft")
  .addParam("tokenid", "token id of nft")
  .setAction(async ({ sender, nft, tokenid }, { ethers, network, run }) => {
    await run("set-DRE");
    console.log(`sender: ${sender}`);
    console.log(`nft: ${nft}`);
    console.log(`tokenid: ${tokenid}`);
    const bendProtocolParams = getParams(BendProtocol, network.name);
    const bendAddressesProvider = await getContract<ILendPoolAddressesProvider>(
      "ILendPoolAddressesProvider",
      bendProtocolParams[0]
    );
    const bendLendPool = await getContract<ILendPool>("ILendPool", await bendAddressesProvider.getLendPool());
    const weth = getParams(WETH, network.name);
    const signer = new ethers.Wallet(await findPrivateKey(sender), ethers.provider);
    const wethContract = await getContract<IWETH>("IWETH", weth);
    const allowance = await wethContract.allowance(sender, bendLendPool.address);
    if (allowance.lt(constants.MaxUint256)) {
      console.log("approve weth");
      waitForTx(await wethContract.connect(signer).approve(bendLendPool.address, constants.MaxUint256));
    }
    waitForTx(await bendLendPool.connect(signer).repay(nft, tokenid, constants.MaxUint256));
  });

task("list:x2y2", "list order in x2y2")
  .addParam("maker", "address of maker")
  .addParam("nft", "address of nft")
  .addParam("tokenid", "token id of nft")
  .addParam("price", "sell price of nft")
  .setAction(async ({ maker, nft, tokenid, price }, { ethers, network, run }) => {
    await run("set-DRE");
    const chainId = await getChainId();
    console.log(`chainId: ${chainId}`);
    console.log(`maker: ${maker}`);
    console.log(`nft: ${nft}`);
    console.log(`tokenid: ${tokenid}`);
    x2y2Sdk.init(process.env.X2Y2_KEY || "");
    const config = getParams(X2Y2, network.name);
    const delegate = config[1];
    const makerSigner = new ethers.Wallet(await findPrivateKey(maker), ethers.provider);
    price = parseEther(price);

    const nftContract = await getContract("IERC721", nft);
    const nftAllowance = await nftContract.isApprovedForAll(maker, delegate);
    if (!nftAllowance) {
      console.log("approve maker nft");
      waitForTx(await nftContract.connect(makerSigner).setApprovalForAll(delegate, true));
    }
    const utils = await import("../test/helpers/block-traveller");
    await x2y2Sdk.list({
      network: "goerli",
      signer: makerSigner,
      tokenAddress: nft,
      tokenId: tokenid,
      price: price.toString(),
      expirationTime: (await utils.latest()) + 6000,
    });
  });

// task("downpayment:x2y2", "downpayment with x2y2")
//   .addParam("taker", "address of taker")
//   .addParam("nft", "address of nft")
//   .addParam("tokenid", "token id of nft")
//   .addParam("price", "sell price of nft")
//   .setAction(async ({ taker, nft, tokenid, price }, { ethers, network, run }) => {
//     await run("set-DRE");
//     const chainId = await getChainId();
//     console.log(`chainId: ${chainId}`);
//     console.log(`taker: ${taker}`);
//     console.log(`nft: ${nft}`);
//     console.log(`tokenid: ${tokenid}`);
//     x2y2Sdk.init(process.env.X2Y2_KEY || "");
//     const adapter = await getContractAddressFromDB("X2Y2Adapter");
//     const downpayment = await getContractFromDB<Downpayment>("Downpayment");
//     const nonce = await downpayment.nonces(taker);

//     const takerSigner = new ethers.Wallet(await findPrivateKey(taker), ethers.provider);
//     price = parseEther(price);

//     const weth = getParams(WETH, network.name);

//     const bendProtocolParams = getParams(BendProtocol, network.name);

//     const bendAddressesProvider = await getContract<ILendPoolAddressesProvider>(
//       "ILendPoolAddressesProvider",
//       bendProtocolParams[0]
//     );
//     const bendLendPool = await getContract("ILendPool", await bendAddressesProvider.getLendPool());
//     const debtWETH = await getContract("IDebtToken", bendProtocolParams[2]);
//     const nftCollateralData = await bendLendPool.getNftCollateralData(nft, weth);
//     const borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
//     console.log(`borrow amount: ${borrowAmount.toString()}`);

//     // check allowance
//     const wethContract = await getContract("IWETH", weth);
//     const allowance = await wethContract.allowance(taker, adapter);
//     if (allowance.lt(price)) {
//       console.log("approve taker weth");
//       waitForTx(await wethContract.connect(takerSigner).approve(adapter, constants.MaxUint256));
//       console.log("approve taker debtWETH");
//       waitForTx(await debtWETH.connect(takerSigner).approveDelegation(adapter, constants.MaxUint256));
//     }

//     const api = x2y2Api.getSharedAPIClient("goerli");
//     const order = await api.getSellOrder("", nft, tokenid);
//     if (!order || order.price !== price.toString()) throw new Error("No order found");
//     const runInput = await api.fetchOrderSign(adapter, 1, order.id, order.currency, order.price, tokenid);
//     if (!runInput) throw new Error("No runInput found");
//     const x2y2 = await import("../test/signer/x2y2.bk");
//     const dataWithsig = await x2y2.createSignedFlashloanParams(chainId, taker, adapter, runInput, nonce);
//     waitForTx(
//       await downpayment
//         .connect(takerSigner)
//         .buy(adapter, borrowAmount, dataWithsig.data, dataWithsig.sig, { value: price.sub(borrowAmount) })
//     );
//   });

task("downpayment:bendExchange", "downpayment with bend exchange")
  .addParam("maker", "address of maker")
  .addParam("taker", "address of taker")
  .addParam("nft", "address of nft")
  .addParam("tokenid", "token id of nft")
  .addParam("price", "sell price of nft")
  .addParam("nonce", "nonce of order")
  .setAction(async ({ maker, taker, nft, tokenid, price, nonce }, { ethers, network, run }) => {
    await run("set-DRE");
    const chainId = await getChainId();
    console.log(`chainId: ${chainId}`);
    console.log(`maker: ${maker}`);
    console.log(`taker: ${taker}`);
    console.log(`nft: ${nft}`);
    console.log(`tokenid: ${tokenid}`);
    console.log(`nonce: ${nonce}`);

    const config = getParams(BendExchange, network.name);
    const bendExchange = await getContract<IBendExchange>("IBendExchange", config[0]);
    const strategy = config[1];

    const bendExchangeAdapter = await getContractAddressFromDB("BendExchangeAdapter");
    const downpayment = await getContractFromDB<Downpayment>("Downpayment");

    const makerSigner = new ethers.Wallet(await findPrivateKey(maker), ethers.provider);
    const takerSigner = new ethers.Wallet(await findPrivateKey(taker), ethers.provider);
    const emptyEncodedBytes = defaultAbiCoder.encode([], []);
    price = parseEther(price);

    const weth = getParams(WETH, network.name);

    const bendProtocolParams = getParams(BendProtocol, network.name);

    const bendAddressesProvider = await getContract<ILendPoolAddressesProvider>(
      "ILendPoolAddressesProvider",
      bendProtocolParams[0]
    );
    const bendLendPool = await getContract("ILendPool", await bendAddressesProvider.getLendPool());
    const debtWETH = await getContract("IDebtToken", bendProtocolParams[2]);
    const nftCollateralData = await bendLendPool.getNftCollateralData(nft, weth);
    const borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    console.log(`borrow amount: ${borrowAmount.toString()}`);

    // check proxy
    const authManager = await getContract<IAuthorizationManager>(
      "IAuthorizationManager",
      await bendExchange.authorizationManager()
    );
    if ((await authManager.proxies(maker)) === constants.AddressZero) {
      console.log("register maker proxy");
      waitForTx(await authManager.connect(makerSigner).registerProxy());
    }

    const makerProxy = await authManager.proxies(maker);
    // check allowance
    const wethContract = await getContract("IWETH", weth);
    const allowance = await wethContract.allowance(taker, bendExchangeAdapter);
    if (allowance.lt(price)) {
      console.log("approve taker weth");
      waitForTx(await wethContract.connect(takerSigner).approve(bendExchangeAdapter, constants.MaxUint256));
      console.log("approve taker debtWETH");
      waitForTx(await debtWETH.connect(takerSigner).approveDelegation(bendExchangeAdapter, constants.MaxUint256));
    }

    const nftContract = await getContract("IERC721", nft);
    const nftAllowance = await nftContract.isApprovedForAll(maker, makerProxy);
    if (!nftAllowance) {
      console.log("approve maker nft");
      waitForTx(await nftContract.connect(makerSigner).setApprovalForAll(makerProxy, true));
    }

    const startTimeNow = BigNumber.from(
      (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
    );
    const startTimeOrder = startTimeNow.sub(3600 * 24);
    const endTimeOrder = startTimeNow.add(3600 * 24);
    const dataWithSig = await bend.createSignedFlashloanParams(
      taker,
      {
        isOrderAsk: true,
        maker: maker,
        interceptor: constants.AddressZero,
        interceptorExtra: emptyEncodedBytes,
        collection: nft,
        price,
        tokenId: tokenid,
        amount: constants.One,
        strategy,
        currency: constants.AddressZero,
        nonce,
        startTime: startTimeOrder,
        endTime: endTimeOrder,
        minPercentageToAsk: constants.Zero,
        params: emptyEncodedBytes,
        signerUser: maker,
        chainId: chainId,
        verifyingContract: bendExchange.address,
      },
      bendExchangeAdapter,
      await downpayment.nonces(taker)
    );
    waitForTx(
      await downpayment
        .connect(takerSigner)
        .buy(bendExchangeAdapter, borrowAmount, dataWithSig.data, dataWithSig.sig, { value: price.sub(borrowAmount) })
    );
  });

task("downpayment:seaport", "downpayment with seaport exchange")
  .addParam("maker", "address of maker")
  .addParam("taker", "address of taker")
  .addParam("nft", "address of nft")
  .addParam("tokenid", "token id of nft")
  .addParam("price", "sell price of nft")
  .setAction(async ({ maker, taker, nft, tokenid, price }, { ethers, network, run }) => {
    await run("set-DRE");
    const chainId = await getChainId();
    console.log(`chainId: ${chainId}`);
    console.log(`maker: ${maker}`);
    console.log(`taker: ${taker}`);
    console.log(`nft: ${nft}`);
    console.log(`tokenid: ${tokenid}`);

    const config = getParams(Seaport14, network.name);
    const exchange = await getContract<ISeaport>("ISeaport", config[0]);
    const conduitKey = config[1];
    const conduitAddress = config[2];

    const adapter = await getContractAddressFromDB("SeaportAdapter");
    const downpayment = await getContractFromDB<Downpayment>("Downpayment");
    const nonce = await downpayment.nonces(taker);

    const makerSigner = new ethers.Wallet(await findPrivateKey(maker), ethers.provider);
    const takerSigner = new ethers.Wallet(await findPrivateKey(taker), ethers.provider);
    price = parseEther(price);

    const weth = getParams(WETH, network.name);

    const bendProtocolParams = getParams(BendProtocol, network.name);

    const bendAddressesProvider = await getContract<ILendPoolAddressesProvider>(
      "ILendPoolAddressesProvider",
      bendProtocolParams[0]
    );
    const bendLendPool = await getContract("ILendPool", await bendAddressesProvider.getLendPool());
    const debtWETH = await getContract("IDebtToken", bendProtocolParams[2]);
    const nftCollateralData = await bendLendPool.getNftCollateralData(nft, weth);
    const borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    console.log(`borrow amount: ${borrowAmount.toString()}`);

    // check allowance
    const wethContract = await getContract("IWETH", weth);
    const allowance = await wethContract.allowance(taker, adapter);
    if (allowance.lt(price)) {
      console.log("approve taker weth");
      waitForTx(await wethContract.connect(takerSigner).approve(adapter, constants.MaxUint256));
      console.log("approve taker debtWETH");
      waitForTx(await debtWETH.connect(takerSigner).approveDelegation(adapter, constants.MaxUint256));
    }

    const nftContract = await getContract<ERC721>("ERC721", nft);
    const nftAllowance = await nftContract.isApprovedForAll(maker, conduitAddress);
    if (!nftAllowance) {
      console.log("approve maker nft");
      waitForTx(await nftContract.connect(makerSigner).setApprovalForAll(conduitAddress, true));
    }

    const startTimeNow = BigNumber.from(
      (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
    );

    const exchangeNonce = await exchange.getCounter(maker);

    const order = await seaport.createOrder({
      offerer: maker,
      conduitKey: conduitKey,
      orderType: seaport.OrderType.FULL_RESTRICTED,
      startTime: startTimeNow,
      endTime: startTimeNow.add(1000),
      offer: {
        itemType: seaport.ItemType.ERC721,
        token: nft,
        identifier: tokenid,
      },
      consideration: {
        token: weth,
        amount: price.toString(),
        recipient: maker,
      },
      fees: [
        {
          basisPoints: 200,
          recipient: taker,
        },
      ],
      nonce: exchangeNonce,
    });

    const signedOrder = await seaport.signOrder(chainId, maker, exchange.address, order, conduitKey, exchangeNonce);

    const dataWithSig = await seaport.createSignedFlashloanParams(chainId, taker, adapter, signedOrder, nonce);
    waitForTx(await downpayment.connect(takerSigner).buy(adapter, borrowAmount, dataWithSig.data, dataWithSig.sig));
  });

task("downpayment:punk", "downpayment with punk market")
  .addParam("maker", "address of maker")
  .addParam("taker", "address of taker")
  .addParam("nft", "address of nft")
  .addParam("tokenid", "token id of nft")
  .addParam("price", "sell price of nft")
  .setAction(async ({ maker, taker, nft, tokenid, price }, { ethers, network, run }) => {
    await run("set-DRE");
    const chainId = await getChainId();
    console.log(`chainId: ${chainId}`);
    console.log(`maker: ${maker}`);
    console.log(`taker: ${taker}`);
    console.log(`nft: ${nft}`);
    console.log(`tokenid: ${tokenid}`);

    const config = getParams(PunkMarket, network.name);
    const punkMarket = await ethers.getContractAt("ICryptoPunksMarket", config[0]);
    const wrappedPunk = await ethers.getContractAt("IWrappedPunks", config[1]);

    const adapter = await getContractAddressFromDB("PunkAdapter");
    const downpayment = await getContractFromDB<Downpayment>("Downpayment");
    const nonce = await downpayment.nonces(taker);

    const makerSigner = new ethers.Wallet(await findPrivateKey(maker), ethers.provider);
    const takerSigner = new ethers.Wallet(await findPrivateKey(taker), ethers.provider);
    price = parseEther(price);

    if (!(await punkMarket.punksOfferedForSale(tokenid))) {
      waitForTx(await punkMarket.connect(makerSigner).offerPunkForSale(tokenid, price));
    }

    const weth = getParams(WETH, network.name);

    const bendProtocolParams = getParams(BendProtocol, network.name);

    const bendAddressesProvider = await getContract<ILendPoolAddressesProvider>(
      "ILendPoolAddressesProvider",
      bendProtocolParams[0]
    );
    const bendLendPool = await getContract("ILendPool", await bendAddressesProvider.getLendPool());
    const debtWETH = await getContract("IDebtToken", bendProtocolParams[2]);
    const nftCollateralData = await bendLendPool.getNftCollateralData(wrappedPunk.address, weth);
    const borrowAmount = nftCollateralData.availableBorrowsInReserve.sub(1);
    console.log(`borrow amount: ${borrowAmount.toString()}`);

    // check allowance
    const wethContract = await getContract("IWETH", weth);
    const allowance = await wethContract.allowance(taker, adapter);
    if (allowance.lt(price)) {
      console.log("approve taker weth");
      waitForTx(await wethContract.connect(takerSigner).approve(adapter, constants.MaxUint256));
      console.log("approve taker debtWETH");
      waitForTx(await debtWETH.connect(takerSigner).approveDelegation(adapter, constants.MaxUint256));
    }

    const dataWithSig = await punk.createSignedFlashloanParams(taker, chainId, nonce, adapter, tokenid, price);
    waitForTx(
      await downpayment
        .connect(takerSigner)
        .buy(adapter, borrowAmount, dataWithSig.data, dataWithSig.sig, { value: price })
    );
  });
