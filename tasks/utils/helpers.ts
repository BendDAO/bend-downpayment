/* eslint-disable @typescript-eslint/no-explicit-any */
import { Contract, ContractReceipt, ContractTransaction, Signer } from "ethers";
import { verifyEtherscanContract } from "./verification";
import { DRE, DB } from "./DRE";

export const waitForTx = async (tx: ContractTransaction): Promise<ContractReceipt> => await tx.wait(1);

export const registerContractInJsonDB = async (contractId: string, contractInstance: Contract): Promise<void> => {
  const currentNetwork = DRE.network.name;
  console.log(`\n*** ${contractId} ***\n`);
  console.log(`Network: ${currentNetwork}`);
  console.log(`tx: ${contractInstance.deployTransaction.hash}`);
  console.log(`contract address: ${contractInstance.address}`);
  console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
  console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
  console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
  console.log(`\n******`);
  console.log();

  DB.set(contractId, {
    address: contractInstance.address,
    deployer: contractInstance.deployTransaction.from,
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
  return await Promise.all(await DRE.ethers.getSigners());
};

export const getSignerByAddress = async (address: string): Promise<Signer> => {
  return await DRE.ethers.getSigner(address);
};

export const getSignersAddresses = async (): Promise<string[]> =>
  await Promise.all((await getSigners()).map((signer) => signer.getAddress()));

export const deployContract = async (contractName: string, args: any[], verify?: boolean): Promise<Contract> => {
  console.log("deploy", contractName);
  const instance = await (await DRE.ethers.getContractFactory(contractName))
    .connect(await getDeploySigner())
    .deploy(...args);
  await withSaveAndVerify(instance, contractName, args, verify);
  return instance;
};

export const withSaveAndVerify = async (
  instance: Contract,
  id: string,
  args: (string | string[] | any)[],
  verify?: boolean
): Promise<Contract> => {
  await waitForTx(instance.deployTransaction);
  await registerContractInJsonDB(id, instance);
  if (verify) {
    await verifyEtherscanContract(instance.address, args);
  }
  return instance;
};

export const getChainId = async (): Promise<number> => {
  return (await DRE.ethers.provider.getNetwork()).chainId;
};

export const getContract = async (contractName: string, address: string): Promise<Contract> => {
  return await DRE.ethers.getContractAt(contractName, address);
};

export const getContractFromDB = async (id: string): Promise<Contract> => {
  return getContract(id, await getContractAddressFromDB(id));
};
