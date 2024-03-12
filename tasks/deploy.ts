/* eslint-disable @typescript-eslint/ban-ts-comment */
import { task } from "hardhat/config";
import {
  AAVE,
  BendExchange,
  BendProtocol,
  FeeCollector,
  getParams,
  LooksRareExchange,
  PunkMarket,
  Seaport15,
  WETH,
  X2Y2,
} from "../test/config";
import { IDownpayment } from "../typechain-types";
import {
  deployContract,
  deployProxyContract,
  deployProxyContractWithID,
  getContractAddressFromDB,
  getContractFromDB,
  waitForTx,
} from "./utils/helpers";
import { verifyEtherscanContract } from "./utils/verification";

task("deploy:full", "Deploy all contracts").setAction(async (_, { run }) => {
  await run("set-DRE");
  await run("compile");
  await run("deploy:downpayment");
  await run("deploy:looksRareExchangeAdapter");
  await run("deploy:bendExchangeAdapter");
  await run("deploy:punkAdapter");
  await run("deploy:seaport15Adapter");
  await run("deploy:x2y2Adapter");
});

task("deploy:downpayment", "Deploy downpayment").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const weth = getParams(WETH, networkName);
  const aaveAddressesProvider = getParams(AAVE, networkName);
  const feeCollector = getParams(FeeCollector, networkName);
  const bendAddressesProvider = getParams(BendProtocol, networkName)[0];

  await deployProxyContract("Downpayment", [aaveAddressesProvider, bendAddressesProvider, feeCollector, weth], true);
});

task("deploy:x2y2Adapter", "Deploy x2y2Adapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const exchange = getParams(X2Y2, networkName)[0];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("X2Y2Adapter", [downpayment.address, exchange], true);
});

task("deploy:seaport15Adapter", "Deploy seaportAdapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const seaportExchange = getParams(Seaport15, networkName)[0];
  const conduitAddress = getParams(Seaport15, networkName)[2];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContractWithID(
    "Seaport15Adapter",
    "SeaportAdapter",
    [downpayment.address, seaportExchange, conduitAddress],
    true
  );
});

task("deploy:looksRareExchangeAdapter", "Deploy looksRareExchangeAdapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const looksRareExchange = getParams(LooksRareExchange, networkName)[0];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("LooksRareExchangeAdapter", [downpayment.address, looksRareExchange], true);
});

task("deploy:bendExchangeAdapter", "Deploy bendExchangeAdapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const bendExchange = getParams(BendExchange, networkName)[0];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("BendExchangeAdapter", [downpayment.address, bendExchange], true);
});

task("deploy:bendExchangeAdapterV2", "Deploy bendExchangeAdapterV2").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const bendExchange = getParams(BendExchange, networkName)[0];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("BendExchangeAdapterV2", [downpayment.address, bendExchange], true);
});

task("deploy:punkAdapter", "Deploy punkAdapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;
  const punkMarketParams = getParams(PunkMarket, networkName);
  const punkMarket = punkMarketParams[0];
  const wrappedPunk = punkMarketParams[1];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("PunkAdapter", [downpayment.address, punkMarket, wrappedPunk], true);
});

task("deploy:mockAAVE", "Deploy mock AAVe").setAction(async (_, { run }) => {
  await run("set-DRE");
  await run("compile");
  await deployContract("MockAaveLendPoolAddressesProvider", [], true);
});

task("config:updateFee", "Config adapter fee")
  .addParam("adapter", "adapter name")
  .addParam("fee", "protocol fee")
  .setAction(async ({ adapter, fee }, { run }) => {
    await run("set-DRE");
    console.log(`updateFee: ${adapter} ${fee}`);
    const downpayment = await getContractFromDB("Downpayment");
    await waitForTx(await downpayment.updateFee(await getContractAddressFromDB(adapter), fee));
  });

task("config:addAdapter", "Add adapter")
  .addParam("adapter", "adapter name")
  .setAction(async ({ adapter }, { run }) => {
    await run("set-DRE");
    console.log(`addAdapter: ${adapter}`);
    const downpayment = await getContractFromDB<IDownpayment>("Downpayment");
    await waitForTx(await downpayment.addAdapter(await getContractAddressFromDB(adapter)));
  });

task("config:removeAdapter", "Remove adapter")
  .addParam("adapter", "adapter name")
  .setAction(async ({ adapter }, { run }) => {
    await run("set-DRE");
    console.log(`removeAdapter: ${adapter}`);
    const downpayment = await getContractFromDB<IDownpayment>("Downpayment");
    await waitForTx(await downpayment.removeAdapter(await getContractAddressFromDB(adapter)));
  });

task("config:full", "Config adapters")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { run }) => {
    await run("set-DRE");

    await run("config:addAdapter", { adapter: "LooksRareExchangeAdapter" });
    await run("config:addAdapter", { adapter: "BendExchangeAdapter" });
    await run("config:addAdapter", { adapter: "PunkAdapter" });
    await run("config:addAdapter", { adapter: "Seaport15Adapter" });
    await run("config:addAdapter", { adapter: "X2Y2Adapter" });

    await run("config:updateFee", { adapter: "LooksRareExchangeAdapter", fee });
    await run("config:updateFee", { adapter: "BendExchangeAdapter", fee });
    await run("config:updateFee", { adapter: "PunkAdapter", fee });
    await run("config:updateFee", { adapter: "Seaport15Adapter", fee });
    await run("config:updateFee", { adapter: "X2Y2Adapter", fee });
  });

task("prepareUpgrade", "Deploy new implmentation for upgrade")
  .addParam("proxyid", "The proxy contract id")
  .addParam("implid", "The new impl contract id")
  .setAction(async ({ proxyid, implid }, { ethers, upgrades, run }) => {
    await run("set-DRE");
    await run("compile");
    const proxyAddress = await getContractAddressFromDB(proxyid);
    const upgradeable = await ethers.getContractFactory(implid);
    console.log(`Preparing ${proxyid} upgrade at proxy ${proxyAddress}`);
    // @ts-ignore
    const implAddress = await upgrades.prepareUpgrade(proxyAddress, upgradeable);
    console.log("Implmentation at:", implAddress);
    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("Proxy admin at:", adminAddress);
    await verifyEtherscanContract(implAddress.toString(), []);
  });

task("upgrade", "upgrade contract")
  .addParam("proxyid", "The proxy contract id")
  .addOptionalParam("implid", "The new impl contract id")
  .addOptionalParam("skipcheck", "Skip upgrade storage check or not")
  .setAction(async ({ skipcheck, proxyid, implid }, { ethers, upgrades, run }) => {
    await run("set-DRE");
    await run("compile");
    if (!implid) {
      implid = proxyid;
    }
    const proxyAddress = await getContractAddressFromDB(proxyid);
    const upgradeable = await ethers.getContractFactory(implid);
    console.log(`Preparing upgrade proxy ${proxyid}: ${proxyAddress} with new ${implid}`);
    // @ts-ignore
    const upgraded = await upgrades.upgradeProxy(proxyAddress, upgradeable, { unsafeSkipStorageCheck: !!skipcheck });
    await upgraded.deployed();
    const implAddress = await upgrades.erc1967.getImplementationAddress(upgraded.address);
    console.log("New implmentation at: ", implAddress);
    await verifyEtherscanContract(implAddress, []);
  });

task("forceImport", "force import implmentation to proxy")
  .addParam("proxy", "The proxy address")
  .addParam("implid", "The new impl contract id")
  .setAction(async ({ proxy, implid }, { ethers, upgrades, run }) => {
    await run("set-DRE");
    await run("compile");
    const upgradeable = await ethers.getContractFactory(implid);
    console.log(`Import proxy: ${proxy} with ${implid}`);
    // @ts-ignore
    await upgrades.forceImport(proxy, upgradeable);
  });

task("verify:Implementation", "Verify Implementation")
  .addParam("proxyid", "The proxy contract id")
  .setAction(async ({ proxyid }, { upgrades, run }) => {
    await run("set-DRE");
    await run("compile");
    const proxyAddress = await getContractAddressFromDB(proxyid);
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("proxyAddress:", proxyAddress, "implAddress:", implAddress);
    await verifyEtherscanContract(implAddress, []);
  });
