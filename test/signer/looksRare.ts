/* eslint-disable node/no-extraneous-import */
import { TypedDataDomain } from "@ethersproject/abstract-signer";
import { Signature } from "@ethersproject/bytes";
import { BigNumber, utils } from "ethers";
import { findPrivateKey } from "../helpers/hardhat-keys";
import { signTypedData } from "../helpers/signature-helper";
const { keccak256, defaultAbiCoder } = utils;
const LOOKSRARE_EXCHANGE_NAME = "LooksRareExchange";
const LOOKSRARE_EXCHANGE_VERSION = "1";

const LOOKSRARE_EXCHANGE_ADAPTER_NAME = "LooksRare Exchange Downpayment Adapter";
const LOOKSRARE_EEXCHANGE_ADAPTER_VERSION = "1.0";

export interface MakerOrder {
  isOrderAsk: boolean; // true if ask, false if bid
  maker: string; //  address of the maker order
  collection: string; // collection address
  price: BigNumber; // price
  tokenId: BigNumber; // id of the token
  amount: BigNumber; // amount of tokens to purchase
  strategy: string; // strategy address for trade execution
  currency: string; // currency address
  nonce: BigNumber; // order nonce
  minPercentageToAsk: BigNumber;
  startTime: BigNumber; // startTime in epoch
  endTime: BigNumber; // endTime in epoch
  params: string; // additional parameters
}

export interface SignedMakerOrder extends MakerOrder {
  r: string; // r: parameter
  s: string; // s: parameter
  v: BigNumber; // v: parameter (27 or 28)
}

export interface TakerOrder {
  isOrderAsk: boolean; // true if ask, false if bid
  taker: string; // Taker address
  price: BigNumber; // price for the purchase
  tokenId: BigNumber;
  minPercentageToAsk: BigNumber;
  params: string; // params (e.g., tokenId)
}

export interface SignMakerOrder extends MakerOrder {
  verifyingContract: string;
  signerUser: string;
  chainId: number;
}

/**
 * Create a signature for a maker order
 * @param chainId chainId
 * @param privateKey privateKey
 * @param verifyingContract verifying contract address
 * @param order see MakerOrder definition
 * @returns splitted signature
 */
export const signMakerOrder = (
  chainId: number,
  privateKey: string,
  verifyingContract: string,
  order: MakerOrder
): Promise<Signature> => {
  const types = [
    "bytes32",
    "bool",
    "address",
    "address",
    "uint256",
    "uint256",
    "uint256",
    "address",
    "address",
    "uint256",
    "uint256",
    "uint256",
    "uint256",
    "bytes32",
  ];

  const values = [
    "0x40261ade532fa1d2c7293df30aaadb9b3c616fae525a0b56d3d411c841a85028",
    order.isOrderAsk,
    order.maker,
    order.collection,
    order.price,
    order.tokenId,
    order.amount,
    order.strategy,
    order.currency,
    order.nonce,
    order.startTime,
    order.endTime,
    order.minPercentageToAsk,
    keccak256(order.params),
  ];

  const domain: TypedDataDomain = {
    name: LOOKSRARE_EXCHANGE_NAME,
    version: LOOKSRARE_EXCHANGE_VERSION,
    chainId,
    verifyingContract,
  };

  return signTypedData(privateKey, types, values, domain);
};

export const signFlashloanParams = (
  chainId: number,
  privateKey: string,
  verifyingContract: string,
  order: SignedMakerOrder,
  nonce: BigNumber
): Promise<Signature> => {
  const types = [
    "bytes32",
    "bool",
    "address",
    "address",
    "uint256",
    "uint256",
    "uint256",
    "address",
    "address",
    "uint256",
    "uint256",
    "uint256",
    "uint256",
    "bytes32",
    "uint8",
    "bytes32",
    "bytes32",
    "uint256",
  ];

  const values = [
    "0xbf059ddc89bea9b899a4344776222fcc16e3ed15cb0e8c6bfe1b284297dde621",
    order.isOrderAsk,
    order.maker,
    order.collection,
    order.price,
    order.tokenId,
    order.amount,
    order.strategy,
    order.currency,
    order.nonce,
    order.startTime,
    order.endTime,
    order.minPercentageToAsk,
    keccak256(order.params),
    BigNumber.from(order.v),
    order.r,
    order.s,
    nonce,
  ];

  const domain: TypedDataDomain = {
    name: LOOKSRARE_EXCHANGE_ADAPTER_NAME,
    version: LOOKSRARE_EEXCHANGE_ADAPTER_VERSION,
    chainId,
    verifyingContract,
  };

  return signTypedData(privateKey, types, values, domain);
};

export async function createSignedMakerOrder({
  isOrderAsk,
  maker,
  collection,
  price,
  tokenId,
  amount,
  strategy,
  currency,
  nonce,
  startTime,
  endTime,
  minPercentageToAsk,
  params,
  signerUser,
  chainId,
  verifyingContract,
}: SignMakerOrder): Promise<SignedMakerOrder> {
  const makerOrder: MakerOrder = {
    isOrderAsk: isOrderAsk,
    maker: maker,
    collection: collection,
    price: price,
    tokenId: tokenId,
    amount: amount,
    strategy: strategy,
    currency: currency,
    nonce: nonce,
    startTime: startTime,
    endTime: endTime,
    minPercentageToAsk: minPercentageToAsk,
    params: params,
  };
  const signedOrder = await signMakerOrder(chainId, await findPrivateKey(signerUser), verifyingContract, makerOrder);

  // Extend makerOrder with proper signature
  const makerOrderExtended: SignedMakerOrder = {
    ...makerOrder,
    r: signedOrder.r,
    s: signedOrder.s,
    v: BigNumber.from(signedOrder.v),
  };

  return makerOrderExtended;
}

export function createTakerOrder({
  isOrderAsk,
  taker,
  price,
  tokenId,
  minPercentageToAsk,
  params,
}: TakerOrder): TakerOrder {
  const takerOrder: TakerOrder = {
    isOrderAsk: isOrderAsk,
    taker: taker,
    price: price,
    tokenId: tokenId,
    minPercentageToAsk: minPercentageToAsk,
    params: params,
  };

  return takerOrder;
}

export interface DataWithSignature {
  data: string;
  sig: Signature;
}

export async function createSignedFlashloanParams(
  signer: string,
  order: SignMakerOrder,
  verifyingContract: string,
  nonce: BigNumber
): Promise<DataWithSignature> {
  const signedOrder: SignedMakerOrder = await createSignedMakerOrder(order);

  const sig: Signature = await signFlashloanParams(
    order.chainId,
    await findPrivateKey(signer),
    verifyingContract,
    signedOrder,
    nonce
  );
  const types =
    "(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)";
  const values = [
    order.isOrderAsk,
    order.maker,
    order.collection,
    order.price,
    order.tokenId,
    order.amount,
    order.strategy,
    order.currency,
    order.nonce,
    order.startTime,
    order.endTime,
    order.minPercentageToAsk,
    order.params,
    signedOrder.v,
    signedOrder.r,
    signedOrder.s,
  ];
  const data = defaultAbiCoder.encode([types], [values]);
  return { data, sig };
}
