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
  IWrappedPunks,
  MintableERC721,
  IOpenseaExchage,
  INFTOracle,
  IBendExchange,
} from "../typechain";
import { getParams, WETH, PunkMarket, OpenseaExchange, BendExchange, BendProtocol, BAYC } from "./config";
import { waitForTx } from "../tasks/utils/helpers";
import { constants } from "ethers";

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
  bayc: MintableERC721;
  bBAYC: IERC721;
  bWPUNK: IERC721;
  punkMarket: ICryptoPunksMarket;
  wrappedPunk: IWrappedPunks;
  punkAdapter: PunkAdapter;
  openseaAdapter: OpenseaAdapter;
  openseaExchange: IOpenseaExchage;
  bendExchange: IBendExchange;
  proxyRegistry: IOpenseaRegistry;
  bendExchangeAdapter: BendExchangeAdapter;
  authorizationManager: IAuthorizationManager;
  aaveLendPool: IAaveLendPool;
  bendLendPool: ILendPool;
  nftOracle: INFTOracle;
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
    waitForTx(await contracts.weth.connect(user).deposit({ value: parseEther("100") }));
  }

  waitForTx(await contracts.weth.connect(env.admin).deposit({ value: parseEther("1000") }));
  waitForTx(await contracts.weth.connect(env.admin).transfer(contracts.aaveLendPool.address, parseEther("800")));

  waitForTx(await contracts.downpayment.updateFee(contracts.punkAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.openseaAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.bendExchangeAdapter.address, env.fee));

  waitForTx(await contracts.weth.connect(env.admin).approve(contracts.bendLendPool.address, constants.MaxUint256));
  waitForTx(
    await contracts.bendLendPool
      .connect(env.admin)
      .deposit(contracts.weth.address, parseEther("200"), env.admin.address, 0)
  );
}

export async function setupContracts(): Promise<Contracts> {
  const networkName = network.name;

  const bayc = await ethers.getContractAt("MintableERC721", getParams(BAYC, networkName));

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
  const bBAYC = await ethers.getContractAt("IERC721", bendProtocolParams[5]);
  const nftOracle = await ethers.getContractAt("INFTOracle", bendProtocolParams[6]);

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
  const wrappedPunk = await ethers.getContractAt("IWrappedPunks", punkMarketParams[1]);

  const PunkAdapter = await ethers.getContractFactory("PunkAdapter");
  const punkAdapter = await PunkAdapter.deploy();
  await punkAdapter.deployed();
  await punkAdapter.initialize(downpayment.address, punkMarket.address, punkMarketParams[1]);

  // opensea
  const openseaExchange = await ethers.getContractAt("IOpenseaExchage", getParams(OpenseaExchange, networkName)[0]);
  const proxyRegistry = await ethers.getContractAt("IOpenseaRegistry", await openseaExchange.registry());
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
  await bendExchangeAdapter.initialize(downpayment.address, bendExchange.address);

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
    bayc,
    bBAYC,
    bWPUNK,
    punkMarket,
    wrappedPunk,
    punkAdapter,
    openseaAdapter,
    openseaExchange,
    proxyRegistry,
    bendExchangeAdapter,
    bendExchange,
    authorizationManager,
    aaveLendPool,
    bendLendPool,
    nftOracle,
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
