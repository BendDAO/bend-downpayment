/* eslint-disable node/no-extraneous-import */
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import { BigNumber, utils } from "ethers";
import { fromRpcSig, ECDSASignature } from "ethereumjs-util";
import { signTypedData, SignTypedDataVersion } from "@metamask/eth-sig-util";
import { findPrivateKey } from "../helpers/hardhat-keys";
const { defaultAbiCoder } = utils;

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

export interface DataWithSignature {
  data: string;
  sig: ECDSASignature;
}

export async function createSignedFlashloanParams(
  signer: string,
  chainId: number,
  nonce: BigNumber,
  adapter: string,
  punkIndex: number,
  buyPrice: BigNumber
): Promise<DataWithSignature> {
  const sig = signFlashLoanParams(await findPrivateKey(signer), chainId, nonce, adapter, punkIndex, buyPrice);
  const data: string = defaultAbiCoder.encode(["(uint256,uint256)"], [[punkIndex.toString(), buyPrice.toString()]]);
  return { data, sig };
}

export const EIP_712_ADAPTER_DOMAIN_NAME = "Punk Downpayment Adapter";
export const EIP_712_ADAPTER_DOMAIN_VERSION = "1.0";
