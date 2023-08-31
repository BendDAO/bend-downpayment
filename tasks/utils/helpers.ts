/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseContract,
  Contract,
  ContractTransactionReceipt,
  ContractTransactionResponse,
  Signer,
  ethers,
} from "ethers";
import { verifyEtherscanContract } from "./verification";
import { DRE, DB } from "./DRE";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const waitForTx = async (tx: ContractTransactionResponse | null): Promise<null | ContractTransactionReceipt> =>
  (await tx?.wait(1)) || null;

export const registerContractInJsonDB = async (contractId: string, contractInstance: BaseContract): Promise<void> => {
  const currentNetwork = DRE.network.name;
  console.log(`\n*** ${contractId} ***\n`);
  console.log(`Network: ${currentNetwork}`);
  console.log(`tx: ${contractInstance.deploymentTransaction()?.hash}`);
  console.log(`contract address: ${await contractInstance.getAddress()}`);
  console.log(`deployer address: ${contractInstance.deploymentTransaction()?.from}`);
  console.log(`gas price: ${contractInstance.deploymentTransaction()?.gasPrice}`);
  console.log(`gas used: ${contractInstance.deploymentTransaction()?.gasLimit}`);
  console.log(`\n******`);
  console.log();

  DB.set(contractId, {
    address: await contractInstance.getAddress(),
    deployer: contractInstance.deploymentTransaction()?.from,
  }).write();
};

export const getContractAddressFromDB = async (id: string): Promise<string> => {
  const contractAtDb = DB.get(id).value();
  if (contractAtDb?.address) {
    return contractAtDb.address;
  }
  throw Error(`Missing contract address ${id} from local DB`);
};

export const getDeploySigner = async (): Promise<Signer> => (await getSigners())[0];

export const getSigners = async (): Promise<Signer[]> => {
  return DRE.ethers.getSigners();
};

export const getSignerByAddress = async (address: string): Promise<Signer> => {
  return await DRE.ethers.getSigner(address);
};

export const getSignersAddresses = async (): Promise<string[]> =>
  await Promise.all((await getSigners()).map((signer) => signer.getAddress()));

export const deployContract = async (contractName: string, args: any[], verify?: boolean): Promise<BaseContract> => {
  console.log("deploy", contractName);
  const instance = await (await DRE.ethers.getContractFactory(contractName))
    .connect(await getDeploySigner())
    .deploy(...args);
  await withSaveAndVerify(instance, contractName, args, verify);
  return instance;
};

export const deployProxyContract = async (contractName: string, args: any[], verify?: boolean): Promise<Contract> => {
  console.log("deploy", contractName);
  const factory = await DRE.ethers.getContractFactory(contractName);
  const instance = await DRE.upgrades.deployProxy(factory, args, {
    timeout: 0,
  });
  await withSaveAndVerify(instance, contractName, args, verify);
  return instance;
};

export const deployProxyContractWithID = async (
  id: string,
  contractName: string,
  args: any[],
  verify?: boolean
): Promise<Contract> => {
  console.log("deploy", contractName);
  const factory = await DRE.ethers.getContractFactory(contractName);
  const instance = await DRE.upgrades.deployProxy(factory, args, {
    timeout: 0,
  });
  await withSaveAndVerify(instance, id, args, verify);
  return instance;
};

export const withSaveAndVerify = async (
  instance: BaseContract,
  id: string,
  args: (string | string[] | any)[],
  verify?: boolean
): Promise<BaseContract> => {
  await instance.waitForDeployment();
  await registerContractInJsonDB(id, instance);
  if (verify) {
    let impl = ethers.ZeroAddress;
    try {
      impl = await DRE.upgrades.erc1967.getImplementationAddress(await instance.getAddress());
    } catch (error) {
      impl = ethers.ZeroAddress;
    }
    if (impl !== ethers.ZeroAddress) {
      await verifyEtherscanContract(impl, []);
    } else {
      await verifyEtherscanContract(await instance.getAddress(), args);
    }
  }
  return instance;
};

export const getChainId = async (): Promise<bigint> => {
  return (await DRE.ethers.provider.getNetwork()).chainId;
};

export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> => (await DRE.ethers.getContractAt(contractName, address)) as ContractType;

export const getContractFromDB = async <ContractType extends Contract>(id: string): Promise<ContractType> => {
  return getContract(id, await getContractAddressFromDB(id));
};

export const impersonateAccountsHardhat = async (accounts: string[]): Promise<void> => {
  // eslint-disable-next-line no-restricted-syntax
  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    await (DRE as HardhatRuntimeEnvironment).network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [account],
    });
  }
};
