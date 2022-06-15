/* eslint-disable @typescript-eslint/no-explicit-any */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import {
  Downpayment,
  PunkAdapter,
  OpenseaAdapter,
  BendExchangeAdapter,
  IWETH,
  IOpenseaRegistry,
  IAuthorizationManager,
  IAaveLendPool,
  ILendPool,
  IDebtToken,
  ICryptoPunksMarket,
  IERC721,
  IBendCollector,
  IBToken,
} from "../typechain";
import { getParams, WETH, PunkMarket, OpenseaExchange, BendExchange, BendProtocol } from "../tasks/config";

export interface Env {
  initialized: boolean;
  fee: number;
  accounts: SignerWithAddress[];
  admin: SignerWithAddress;
  chainId: number;
}

export interface Contracts {
  initialized: boolean;
  weth: IWETH;
  bWETH: IBToken;
  debtWETH: IDebtToken;
  bWPUNK: IERC721;
  punkMarket: ICryptoPunksMarket;
  wrappedPunk: IERC721;
  punkAdapter: PunkAdapter;
  openseaAdapter: OpenseaAdapter;
  proxyRegitry: IOpenseaRegistry;
  bendExchangeAdapter: BendExchangeAdapter;
  authorizationManager: IAuthorizationManager;
  aaveLendPool: IAaveLendPool;
  bendLendPool: ILendPool;
  bendCollector: IBendCollector;
  downpayment: Downpayment;
}

export async function setupEnv(env: Env, contracts: Contracts): Promise<void> {
  env.fee = 100;
  env.accounts = await ethers.getSigners();
  env.admin = env.accounts[0];
  env.chainId = (await ethers.provider.getNetwork()).chainId;
  const users = env.accounts.slice(1, 10);
  for (const user of users) {
    // Each user gets 30 WETH
    await contracts.weth.connect(user).deposit({ value: parseEther("100") });
  }

  await contracts.weth.connect(env.admin).deposit({ value: parseEther("1000") });
  await contracts.weth.connect(env.admin).transfer(contracts.aaveLendPool.address, parseEther("1000"));

  await contracts.downpayment.updateFee(contracts.punkAdapter.address, env.fee);
  await contracts.downpayment.updateFee(contracts.openseaAdapter.address, env.fee);
  await contracts.downpayment.updateFee(contracts.bendExchangeAdapter.address, env.fee);
}

export async function setupContracts(): Promise<Contracts> {
  const networkName = network.name;

  // we mock aave due to no rinkeby addresses
  const MockAaveLendPoolAddressesProvider = await ethers.getContractFactory("MockAaveLendPoolAddressesProvider");
  const mockAaveLendPoolAddressesProvider = await MockAaveLendPoolAddressesProvider.deploy();
  await mockAaveLendPoolAddressesProvider.deployed();
  const aaveLendPool = await ethers.getContractAt(
    "IAaveLendPool",
    await mockAaveLendPoolAddressesProvider.getLendingPool()
  );

  // bend protocol
  const bendProtocolParams = getParams(BendProtocol, networkName);
  const bendAddressesProvider = await ethers.getContractAt("ILendPoolAddressesProvider", bendProtocolParams[0]);
  const bendLendPool = await ethers.getContractAt("ILendPool", await bendAddressesProvider.getLendPool());
  const bendCollector = await ethers.getContractAt("IBendCollector", bendProtocolParams[1]);
  const debtWETH = await ethers.getContractAt("IDebtToken", bendProtocolParams[2]);
  const bWETH = await ethers.getContractAt("IBToken", bendProtocolParams[3]);
  const bWPUNK = await ethers.getContractAt("IERC721", bendProtocolParams[4]);

  const weth = await ethers.getContractAt("IWETH", getParams(WETH, networkName));

  const Downpayment = await ethers.getContractFactory("Downpayment");
  const downpayment = await Downpayment.deploy(
    mockAaveLendPoolAddressesProvider.address,
    bendAddressesProvider.address,
    bendCollector.address,
    weth.address
  );
  await downpayment.deployed();

  // punk
  const punkMarketParams = getParams(PunkMarket, networkName);
  const punkMarket = await ethers.getContractAt("ICryptoPunksMarket", punkMarketParams[0]);
  const wrappedPunk = await ethers.getContractAt("IERC721", punkMarketParams[1]);

  const PunkAdapter = await ethers.getContractFactory("PunkAdapter");
  const punkAdapter = await PunkAdapter.deploy();
  await punkAdapter.deployed();
  await punkAdapter.initialize(downpayment.address, punkMarket.address, punkMarketParams[1]);

  // opensea
  const openseaExchange = await ethers.getContractAt("IOpenseaExchage", getParams(OpenseaExchange, networkName));
  const proxyRegitry = await ethers.getContractAt("IOpenseaRegistry", await openseaExchange.registry());
  const OpenseaAdapter = await ethers.getContractFactory("OpenseaAdapter");
  const openseaAdapter = await OpenseaAdapter.deploy();
  await openseaAdapter.deployed();
  await openseaAdapter.initialize(downpayment.address, openseaExchange.address);

  // bend
  const bendExchangeParams = getParams(BendExchange, networkName);
  const bendExchange = await ethers.getContractAt("IBendExchange", bendExchangeParams[0]);
  const authorizationManager = await ethers.getContractAt(
    "IAuthorizationManager",
    await bendExchange.authorizationManager()
  );
  const BendExchangeAdapter = await ethers.getContractFactory("BendExchangeAdapter");
  const bendExchangeAdapter = await BendExchangeAdapter.deploy();
  await bendExchangeAdapter.deployed();
  await bendExchangeAdapter.initialize(downpayment.address, bendExchange.address, authorizationManager.address);

  await downpayment.addAdapter(punkAdapter.address);
  await downpayment.addAdapter(openseaAdapter.address);
  await downpayment.addAdapter(bendExchangeAdapter.address);

  /** Return contracts
   */
  return {
    initialized: true,
    weth,
    bWETH,
    debtWETH,
    bWPUNK,
    punkMarket,
    wrappedPunk,
    punkAdapter,
    openseaAdapter,
    proxyRegitry,
    bendExchangeAdapter,
    authorizationManager,
    aaveLendPool,
    bendLendPool,
    bendCollector,
    downpayment,
  } as Contracts;
}

export class Snapshots {
  ids = new Map<string, string>();

  async capture(tag: string): Promise<void> {
    this.ids.set(tag, await this.evmSnapshot());
  }

  async revert(tag: string): Promise<void> {
    await this.evmRevert(this.ids.get(tag) || "1");
    await this.capture(tag);
  }

  async evmSnapshot(): Promise<any> {
    return await ethers.provider.send("evm_snapshot", []);
  }

  async evmRevert(id: string): Promise<any> {
    return await ethers.provider.send("evm_revert", [id]);
  }
}

const contracts: Contracts = { initialized: false } as Contracts;
const env: Env = { initialized: false } as Env;
const snapshots = new Snapshots();
export function makeSuite(name: string, tests: (contracts: Contracts, env: Env, snapshots: Snapshots) => void): void {
  describe(name, () => {
    let _id: any;
    before(async () => {
      if (!env.initialized && !contracts.initialized) {
        Object.assign(contracts, await setupContracts());
        await setupEnv(env, contracts);
        env.initialized = true;
        contracts.initialized = true;
        snapshots.capture("setup");
      }
      _id = await snapshots.evmSnapshot();
    });
    tests(contracts, env, snapshots);
    after(async () => {
      await snapshots.evmRevert(_id);
    });
  });
}
