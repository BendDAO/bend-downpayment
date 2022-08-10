/* eslint-disable @typescript-eslint/ban-ts-comment */
import { task } from "hardhat/config";
import {
  AAVE,
  BendExchange,
  BendProtocol,
  FeeCollector,
  getParams,
  LooksRareExchange,
  OpenseaExchange,
  PunkMarket,
  Seaport,
  WETH,
  X2Y2,
} from "../test/config";
import { IDownpayment } from "../typechain-types";
import { deployProxyContract, getContractAddressFromDB, getContractFromDB, waitForTx } from "./utils/helpers";
import { verifyEtherscanContract } from "./utils/verification";

task("deploy:full", "Deploy all contracts").setAction(async (_, { run }) => {
  await run("set-DRE");
  await run("compile");
  await run("deploy:downpayment");
  await run("deploy:looksRareExchangeAdapter");
  await run("deploy:bendExchangeAdapter");
  await run("deploy:openseaAdapter");
  await run("deploy:punkAdapter");
  await run("deploy:seaportAdapter");
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

task("deploy:seaportAdapter", "Deploy seaportAdapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const seaportExchange = getParams(Seaport, networkName)[0];
  const conduitAddress = getParams(Seaport, networkName)[3];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("SeaportAdapter", [downpayment.address, seaportExchange, conduitAddress], true);
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

task("deploy:openseaAdapter", "Deploy openseaAdapter").setAction(async (_, { network, run }) => {
  await run("set-DRE");
  await run("compile");
  const networkName = network.name;

  const openseaExchange = getParams(OpenseaExchange, networkName)[0];
  const downpayment = await getContractFromDB("Downpayment");
  await deployProxyContract("OpenseaAdapter", [downpayment.address, openseaExchange], true);
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
    await run("config:addAdapter", { adapter: "OpenseaAdapter" });
    await run("config:addAdapter", { adapter: "PunkAdapter" });
    await run("config:addAdapter", { adapter: "SeaportAdapter" });
    await run("config:addAdapter", { adapter: "X2Y2Adapter" });

    await run("config:updateFee", { adapter: "LooksRareExchangeAdapter", fee });
    await run("config:updateFee", { adapter: "BendExchangeAdapter", fee });
    await run("config:updateFee", { adapter: "OpenseaAdapter", fee });
    await run("config:updateFee", { adapter: "PunkAdapter", fee });
    await run("config:updateFee", { adapter: "SeaportAdapter", fee });
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
  .addParam("implid", "The new impl contract id")
  .setAction(async ({ proxyid, implid }, { ethers, upgrades, run }) => {
    await run("set-DRE");
    await run("compile");
    const proxyAddress = await getContractAddressFromDB(proxyid);
    const upgradeable = await ethers.getContractFactory(implid);
    console.log(`Preparing ${proxyid} upgrade at proxy ${proxyAddress}`);
    // @ts-ignore
    const implAddress = await upgrades.upgradeProxy(proxyAddress, upgradeable, { unsafeSkipStorageCheck: true });
    console.log("Implmentation at:", implAddress.address);
    await verifyEtherscanContract(implAddress.address, []);
  });
