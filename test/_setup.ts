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
  ILooksRareTransferSelectorNFT,
  ILooksRareExchange,
  LooksRareExchangeAdapter,
  SeaportAdapter,
  ISeaport,
} from "../typechain-types";
import {
  getParams,
  WETH,
  PunkMarket,
  OpenseaExchange,
  BendExchange,
  BendProtocol,
  BAYC,
  LooksRareExchange,
  Seaport,
} from "./config";
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
  // weth
  weth: IWETH;
  bWETH: IBToken;
  debtWETH: IDebtToken;

  // nft
  bayc: MintableERC721;
  bBAYC: IERC721;
  bWPUNK: IERC721;
  wrappedPunk: IWrappedPunks;

  // exchanges
  looksRareExchange: ILooksRareExchange;
  transferNFT: ILooksRareTransferSelectorNFT;
  punkMarket: ICryptoPunksMarket;
  openseaExchange: IOpenseaExchage;
  bendExchange: IBendExchange;
  proxyRegistry: IOpenseaRegistry;
  authorizationManager: IAuthorizationManager;
  seaportExchange: ISeaport;

  // adapters
  punkAdapter: PunkAdapter;
  openseaAdapter: OpenseaAdapter;
  bendExchangeAdapter: BendExchangeAdapter;
  looksRareExchangeAdapter: LooksRareExchangeAdapter;
  seaportAdapter: SeaportAdapter;

  // aave
  aaveLendPool: IAaveLendPool;

  // bend protocol
  bendLendPool: ILendPool;
  nftOracle: INFTOracle;
  bendCollector: IBendCollector;

  //
  downpayment: Downpayment;
}

export async function setupEnv(env: Env, contracts: Contracts): Promise<void> {
  env.fee = 100;
  env.accounts = await ethers.getSigners();
  env.admin = env.accounts[0];
  env.chainId = (await ethers.provider.getNetwork()).chainId;

  // init eth
  const users = env.accounts.slice(1, 10);
  for (const user of users) {
    // Each user gets 30 WETH
    waitForTx(await contracts.weth.connect(user).deposit({ value: parseEther("100") }));
  }

  // init aave lend pool
  waitForTx(await contracts.weth.connect(env.admin).deposit({ value: parseEther("1000") }));
  waitForTx(await contracts.weth.connect(env.admin).transfer(contracts.aaveLendPool.address, parseEther("800")));

  // add adapter and fees
  waitForTx(await contracts.downpayment.addAdapter(contracts.punkAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.openseaAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.bendExchangeAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.looksRareExchangeAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.seaportAdapter.address));

  waitForTx(await contracts.downpayment.updateFee(contracts.punkAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.openseaAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.bendExchangeAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.looksRareExchangeAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.seaportAdapter.address, env.fee));

  // add reserve balance for bend
  waitForTx(await contracts.weth.connect(env.admin).approve(contracts.bendLendPool.address, constants.MaxUint256));
  waitForTx(
    await contracts.bendLendPool
      .connect(env.admin)
      .deposit(contracts.weth.address, parseEther("200"), env.admin.address, 0)
  );
}

export async function setupContracts(): Promise<Contracts> {
  const networkName = network.name;

  // config
  const bendProtocolParams = getParams(BendProtocol, networkName);
  const punkMarketParams = getParams(PunkMarket, networkName);
  const bendExchangeParams = getParams(BendExchange, networkName);
  const looksRareExchangeParams = getParams(LooksRareExchange, networkName);
  const seaportParams = getParams(Seaport, networkName);

  // weth
  const weth = await ethers.getContractAt("IWETH", getParams(WETH, networkName));
  const debtWETH = await ethers.getContractAt("IDebtToken", bendProtocolParams[2]);
  const bWETH = await ethers.getContractAt("IBToken", bendProtocolParams[3]);

  // nft
  const bayc = await ethers.getContractAt("MintableERC721", getParams(BAYC, networkName));
  const bWPUNK = await ethers.getContractAt("IERC721", bendProtocolParams[4]);
  const bBAYC = await ethers.getContractAt("IERC721", bendProtocolParams[5]);
  const punkMarket = await ethers.getContractAt("ICryptoPunksMarket", punkMarketParams[0]);
  const wrappedPunk = await ethers.getContractAt("IWrappedPunks", punkMarketParams[1]);

  // exchanges
  const openseaExchange = await ethers.getContractAt("IOpenseaExchage", getParams(OpenseaExchange, networkName)[0]);
  const proxyRegistry = await ethers.getContractAt("IOpenseaRegistry", await openseaExchange.registry());
  const bendExchange = await ethers.getContractAt("IBendExchange", bendExchangeParams[0]);
  const authorizationManager = await ethers.getContractAt(
    "IAuthorizationManager",
    await bendExchange.authorizationManager()
  );
  const looksRareExchange = await ethers.getContractAt("ILooksRareExchange", looksRareExchangeParams[0]);
  const transferNFT = await ethers.getContractAt(
    "ILooksRareTransferSelectorNFT",
    await looksRareExchange.transferSelectorNFT()
  );
  const seaportExchange = await ethers.getContractAt("ISeaport", seaportParams[0]);

  // aave
  // we mock aave due to no rinkeby addresses
  const MockAaveLendPoolAddressesProvider = await ethers.getContractFactory("MockAaveLendPoolAddressesProvider");
  const mockAaveLendPoolAddressesProvider = await MockAaveLendPoolAddressesProvider.deploy();
  await mockAaveLendPoolAddressesProvider.deployed();
  const aaveLendPool = await ethers.getContractAt(
    "IAaveLendPool",
    await mockAaveLendPoolAddressesProvider.getLendingPool()
  );

  // bend protocol
  const bendAddressesProvider = await ethers.getContractAt("ILendPoolAddressesProvider", bendProtocolParams[0]);
  const bendLendPool = await ethers.getContractAt("ILendPool", await bendAddressesProvider.getLendPool());
  const bendCollector = await ethers.getContractAt("IBendCollector", bendProtocolParams[1]);
  const nftOracle = await ethers.getContractAt("INFTOracle", bendProtocolParams[6]);

  // downpayment
  const Downpayment = await ethers.getContractFactory("Downpayment");
  const downpayment = await Downpayment.deploy(
    mockAaveLendPoolAddressesProvider.address,
    bendAddressesProvider.address,
    bendCollector.address,
    weth.address
  );
  await downpayment.deployed();

  // adapters
  const OpenseaAdapter = await ethers.getContractFactory("OpenseaAdapter");
  const openseaAdapter = await OpenseaAdapter.deploy();
  await openseaAdapter.deployed();
  await openseaAdapter.initialize(downpayment.address, openseaExchange.address);

  const PunkAdapter = await ethers.getContractFactory("PunkAdapter");
  const punkAdapter = await PunkAdapter.deploy();
  await punkAdapter.deployed();
  await punkAdapter.initialize(downpayment.address, punkMarket.address, punkMarketParams[1]);

  const BendExchangeAdapter = await ethers.getContractFactory("BendExchangeAdapter");
  const bendExchangeAdapter = await BendExchangeAdapter.deploy();
  await bendExchangeAdapter.deployed();
  await bendExchangeAdapter.initialize(downpayment.address, bendExchange.address);

  const LooksRareExchangeAdapter = await ethers.getContractFactory("LooksRareExchangeAdapter");
  const looksRareExchangeAdapter = await LooksRareExchangeAdapter.deploy();
  await looksRareExchangeAdapter.deployed();
  await looksRareExchangeAdapter.initialize(downpayment.address, looksRareExchange.address);

  const SeaportAdapter = await ethers.getContractFactory("SeaportAdapter");
  const seaportAdapter = await SeaportAdapter.deploy();
  await seaportAdapter.deployed();
  await seaportAdapter.initialize(downpayment.address, seaportExchange.address, seaportParams[3]);

  /** Return contracts
   */
  return {
    initialized: true,
    seaportExchange,
    transferNFT,
    looksRareExchangeAdapter,
    looksRareExchange,
    weth,
    bWETH,
    debtWETH,
    bayc,
    bBAYC,
    bWPUNK,
    seaportAdapter,
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
