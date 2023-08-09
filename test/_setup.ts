/* eslint-disable @typescript-eslint/no-explicit-any */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { parseEther, parseUnits } from "ethers/lib/utils";
import {
  Downpayment,
  PunkAdapter,
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
  X2Y2Adapter,
  IX2Y2,
  MintableERC20,
} from "../typechain-types";
import {
  getParams,
  WETH,
  PunkMarket,
  BendExchange,
  BendProtocol,
  BAYC,
  LooksRareExchange,
  Seaport15,
  X2Y2,
  USDT,
} from "./config";
import { waitForTx } from "../tasks/utils/helpers";
import { constants, Contract } from "ethers";

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

  // mock erc20
  usdt: MintableERC20;
  debtUSDT: IDebtToken;

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
  x2y2Exchange: IX2Y2;

  // adapters
  punkAdapter: PunkAdapter;
  bendExchangeAdapter: BendExchangeAdapter;
  looksRareExchangeAdapter: LooksRareExchangeAdapter;
  seaportAdapter: SeaportAdapter;
  x2y2Adapter: X2Y2Adapter;

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
    waitForTx(await contracts.usdt.connect(user).mint(parseUnits("100", 6)));
  }

  // init aave lend pool
  waitForTx(await contracts.weth.connect(env.admin).deposit({ value: parseEther("1000") }));
  waitForTx(await contracts.weth.connect(env.admin).transfer(contracts.aaveLendPool.address, parseEther("800")));

  waitForTx(await contracts.usdt.connect(env.admin).mint(parseUnits("1000", 6)));
  waitForTx(await contracts.usdt.connect(env.admin).transfer(contracts.aaveLendPool.address, parseUnits("800", 6)));

  // add adapter and fees
  waitForTx(await contracts.downpayment.addAdapter(contracts.punkAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.bendExchangeAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.looksRareExchangeAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.seaportAdapter.address));
  waitForTx(await contracts.downpayment.addAdapter(contracts.x2y2Adapter.address));

  waitForTx(await contracts.downpayment.updateFee(contracts.punkAdapter.address, 0)); // test zero fee

  waitForTx(await contracts.downpayment.updateFee(contracts.bendExchangeAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.looksRareExchangeAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.seaportAdapter.address, env.fee));
  waitForTx(await contracts.downpayment.updateFee(contracts.x2y2Adapter.address, env.fee));

  // add reserve balance for bend
  waitForTx(await contracts.weth.connect(env.admin).approve(contracts.bendLendPool.address, constants.MaxUint256));
  waitForTx(await contracts.usdt.connect(env.admin).approve(contracts.bendLendPool.address, constants.MaxUint256));
  waitForTx(
    await contracts.bendLendPool
      .connect(env.admin)
      .deposit(contracts.weth.address, parseEther("200"), env.admin.address, 0)
  );
  waitForTx(
    await contracts.bendLendPool
      .connect(env.admin)
      .deposit(contracts.usdt.address, parseUnits("200", 6), env.admin.address, 0)
  );
}

export async function setupContracts(): Promise<Contracts> {
  const networkName = network.name;

  // config
  const bendProtocolParams = getParams(BendProtocol, networkName);
  const punkMarketParams = getParams(PunkMarket, networkName);
  const bendExchangeParams = getParams(BendExchange, networkName);
  const looksRareExchangeParams = getParams(LooksRareExchange, networkName);
  const seaportParams = getParams(Seaport15, networkName);
  const x2y2Params = getParams(X2Y2, networkName);

  // weth
  const weth = await ethers.getContractAt("IWETH", getParams(WETH, networkName));
  const debtWETH = await ethers.getContractAt("IDebtToken", bendProtocolParams[2]);
  const bWETH = await ethers.getContractAt("IBToken", bendProtocolParams[3]);
  const usdt = await ethers.getContractAt("MintableERC20", getParams(USDT, networkName));
  const debtUSDT = await ethers.getContractAt("IDebtToken", bendProtocolParams[7]);

  // nft
  const bayc = await ethers.getContractAt("MintableERC721", getParams(BAYC, networkName));
  const bWPUNK = await ethers.getContractAt("IERC721", bendProtocolParams[4]);
  const bBAYC = await ethers.getContractAt("IERC721", bendProtocolParams[5]);
  const punkMarket = await ethers.getContractAt("ICryptoPunksMarket", punkMarketParams[0]);
  const wrappedPunk = await ethers.getContractAt("IWrappedPunks", punkMarketParams[1]);

  // exchanges
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
  const x2y2Exchange = await ethers.getContractAt("IX2Y2", x2y2Params[0]);

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
  const downpayment = await deployContract("Downpayment", []);
  await downpayment.initialize(
    mockAaveLendPoolAddressesProvider.address,
    bendAddressesProvider.address,
    bendCollector.address,
    weth.address
  );

  // adapters

  const punkAdapter = await deployContract("PunkAdapter", []);
  await punkAdapter.initialize(downpayment.address, punkMarket.address, punkMarketParams[1]);

  const bendExchangeAdapter = await deployContract("BendExchangeAdapter", []);
  await bendExchangeAdapter.initialize(downpayment.address, bendExchange.address);

  const looksRareExchangeAdapter = await deployContract("LooksRareExchangeAdapter", []);
  await looksRareExchangeAdapter.initialize(downpayment.address, looksRareExchange.address);

  const seaportAdapter = await deployContract("SeaportAdapter", []);
  await seaportAdapter.initialize(downpayment.address, seaportExchange.address, seaportParams[2]);

  const x2y2Adapter = await deployContract("X2Y2Adapter", []);
  await x2y2Adapter.initialize(downpayment.address, x2y2Exchange.address);

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
    usdt,
    debtUSDT,
    bayc,
    bBAYC,
    bWPUNK,
    x2y2Adapter,
    x2y2Exchange,
    seaportAdapter,
    punkMarket,
    wrappedPunk,
    punkAdapter,
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

async function deployContract<ContractType extends Contract>(contractName: string, args: any[]): Promise<ContractType> {
  const instance = await (await ethers.getContractFactory(contractName)).deploy(...args);

  return instance as ContractType;
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
