import { BigNumber, ContractTransaction } from "ethers";

export async function gasCost(tx: ContractTransaction): Promise<BigNumber> {
  const receipt = await tx.wait();
  return receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice);
}
