/* eslint-disable @typescript-eslint/no-explicit-any */
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export let DB: low.LowdbSync<any>;

export const initDB = (network: string): void => {
  DB = low(new FileSync(`./deployments/deployed-contracts-${network}.json`));
};

export let DRE: HardhatRuntimeEnvironment;

export const setDRE = (_DRE: HardhatRuntimeEnvironment): void => {
  DRE = _DRE;
};
