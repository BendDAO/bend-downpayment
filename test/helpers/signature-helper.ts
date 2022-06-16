import { BigNumber, utils, Wallet } from "ethers";
/* eslint-disable node/no-extraneous-import */
import { TypedDataDomain } from "@ethersproject/abstract-signer";
/* eslint-disable node/no-extraneous-import */
import { Signature } from "@ethersproject/bytes";
/* eslint-disable node/no-extraneous-import */
import { _TypedDataEncoder } from "@ethersproject/hash";

const { defaultAbiCoder, keccak256, solidityPack } = utils;

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Generate a signature used to generate v, r, s parameters
 * @param privateKey privateKey
 * @param types solidity types of the value param
 * @param values params to be sent to the Solidity function
 * @param domain typed data domain
 * @returns splitted signature
 * @see https://docs.ethers.io/v5/api/signer/#Signer-signTypedData
 */
export const signTypedData = async (
  privateKey: string,
  types: string[],
  values: (string | boolean | BigNumber)[],
  domain: TypedDataDomain
): Promise<Signature> => {
  const domainSeparator = _TypedDataEncoder.hashDomain(domain);

  // https://docs.ethers.io/v5/api/utils/abi/coder/#AbiCoder--methods
  const hash = keccak256(defaultAbiCoder.encode(types, values));

  // Compute the digest
  const digest = keccak256(
    solidityPack(["bytes1", "bytes1", "bytes32", "bytes32"], ["0x19", "0x01", domainSeparator, hash])
  );

  const adjustedSigner = new Wallet(privateKey);
  return { ...adjustedSigner._signingKey().signDigest(digest) };
};

export const computeDomainSeparator = (domain: TypedDataDomain): string => {
  return _TypedDataEncoder.hashDomain(domain);
};
