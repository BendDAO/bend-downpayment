/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { expect } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { Contracts, Env, makeSuite, Snapshots } from "./_setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { fromRpcSig, ECDSASignature } from "ethereumjs-util";
import { signTypedData, SignTypedDataVersion } from "@metamask/eth-sig-util";
import { findPrivateKey } from "./helpers/hardhat-keys";
import { waitForTx } from "../tasks/utils/helpers";
import { assertAlmostEqualTol } from "./helpers/equals";
const { defaultAbiCoder, parseEther } = utils;

export const getSignatureFromTypedData = (privateKey: string, typedData: any): ECDSASignature => {
  const signature = signTypedData({
    privateKey: Buffer.from(privateKey.substring(2, 66), "hex"),
    data: typedData,
    version: SignTypedDataVersion.V4,
  });
  return fromRpcSig(signature);
};

export const signFlashLoanParams = (
  privateKey: string,
  chainId: number,
  nonce: BigNumber,
  adapter: string,
  punkIndex: number,
  buyPrice: BigNumber
): ECDSASignature => {
  const message = {
    types: EIP_712_PARAMS_TYPES,
    domain: {
      name: EIP_712_ADAPTER_DOMAIN_NAME,
      version: EIP_712_ADAPTER_DOMAIN_VERSION,
      chainId,
      verifyingContract: adapter,
    },
    primaryType: "Params",
    message: {
      punkIndex: punkIndex.toString(),
      buyPrice: buyPrice.toString(),
      nonce: nonce.toString(),
    },
  };
  return getSignatureFromTypedData(privateKey, message);
};

export const EIP_712_PARAMS_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Params: [
    { name: "punkIndex", type: "uint256" },
    { name: "buyPrice", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

function buildFlashloanParams(punkIndex: number, buyPrice: BigNumber, sig: ECDSASignature) {
  return defaultAbiCoder.encode(
    ["(uint256,uint256,uint8,bytes32,bytes32)"],
    [[punkIndex.toString(), buyPrice.toString(), sig.v, sig.r, sig.s]]
  );
}

export const EIP_712_ADAPTER_DOMAIN_NAME = "Punk Downpayment Adapter";
export const EIP_712_ADAPTER_DOMAIN_VERSION = "1.0";

makeSuite("PunkAdapter", (contracts: Contracts, env: Env, snapshots: Snapshots) => {
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let tokenId: number;
  let sellPrice: BigNumber;
  let borowAmount: BigNumber;
  let nonce: BigNumber;
  before(async () => {
    buyer = env.accounts[1];
    seller = env.accounts[2];
    tokenId = 8674;

    sellPrice = parseEther("10");
    waitForTx(await contracts.punkMarket.connect(seller).getPunk(tokenId));
    waitForTx(await contracts.punkMarket.connect(seller).offerPunkForSale(tokenId, sellPrice));

    const nftCollateralData = await contracts.bendLendPool.getNftCollateralData(
      contracts.wrappedPunk.address,
      contracts.weth.address
    );
    borowAmount = nftCollateralData.availableBorrowsInReserve;
    nonce = await contracts.downpayment.nonces(buyer.address);
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  async function exceptDownpaymentSuccessed(price: BigNumber, borowAmount: BigNumber) {
    const aaveFee = borowAmount.mul(9).div(10000);
    const bendFee = price.mul(env.fee).div(10000);
    const paymentAmount = price.add(aaveFee).add(bendFee).sub(borowAmount);
    const expectAaveWethBalance = (await contracts.weth.balanceOf(contracts.aaveLendPool.address)).add(aaveFee);

    const expectBendCollectorBWethBalance = (await contracts.bWETH.balanceOf(contracts.bendCollector.address)).add(
      bendFee
    );
    const expectBuyerWethBalance = (await contracts.weth.balanceOf(buyer.address)).sub(paymentAmount);
    const sig = signFlashLoanParams(
      findPrivateKey(buyer.address),
      env.chainId,
      nonce,
      contracts.punkAdapter.address,
      tokenId,
      price
    );
    waitForTx(
      await contracts.downpayment
        .connect(buyer)
        .buy(contracts.punkAdapter.address, borowAmount, buildFlashloanParams(tokenId, price, sig))
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
    await contracts.weth.connect(buyer).approve(contracts.punkAdapter.address, constants.MaxUint256);
  }

  async function approveBuyerDebtWeth() {
    await contracts.debtWETH.connect(buyer).approveDelegation(contracts.punkAdapter.address, constants.MaxUint256);
  }

  function exceptDownpayment(price: BigNumber, borowAmount: BigNumber) {
    const sig = signFlashLoanParams(
      findPrivateKey(buyer.address),
      env.chainId,
      nonce,
      contracts.punkAdapter.address,
      tokenId,
      price
    );
    return expect(
      contracts.downpayment
        .connect(buyer)
        .buy(contracts.punkAdapter.address, borowAmount, buildFlashloanParams(tokenId, price, sig))
    );
  }

  it("Order price must be same", async () => {
    await exceptDownpayment(parseEther("9.9"), borowAmount).to.revertedWith("Order price must be same");
  });

  it("Insufficient balance", async () => {
    await exceptDownpayment(sellPrice, borowAmount).to.revertedWith("Insufficient balance");
  });

  it("Should approve WETH and debtWETH", async () => {
    await approveBuyerWeth();
    // no debt weth approvement
    await exceptDownpayment(sellPrice, borowAmount).to.be.not.revertedWith("Insufficient balance");
    await approveBuyerDebtWeth();
    await exceptDownpaymentSuccessed(sellPrice, borowAmount);
  });
});
