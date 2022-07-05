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
} from "../test/config";
import { deployContract, deployProxyContract, getContractFromDB, waitForTx } from "./utils/helpers";

task("deploy:full", "Deploy all contracts")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;

    const weth = getParams(WETH, networkName);
    const aaveAddressesProvider = getParams(AAVE, networkName);
    const feeCollector = getParams(FeeCollector, networkName);
    const bendAddressesProvider = getParams(BendProtocol, networkName)[0];

    await deployContract("Downpayment", [aaveAddressesProvider, bendAddressesProvider, feeCollector, weth], true);
    await run("deploy:looksRareExchangeAdapter", { fee });
    await run("deploy:bendExchangeAdapter", { fee });
    await run("deploy:openseaAdapter", { fee });
    await run("deploy:punkAdapter", { fee });
    await run("deploy:seaportAdapter", { fee });
  });

task("deploy:seaportAdapter", "Deploy seaportAdapter")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;

    const seaportExchange = getParams(Seaport, networkName)[0];
    const conduitAddress = getParams(Seaport, networkName)[3];
    const downpayment = await getContractFromDB("Downpayment");
    const seaportAdapter = await deployProxyContract(
      "SeaportAdapter",
      [downpayment.address, seaportExchange, conduitAddress],
      true
    );
    waitForTx(await downpayment.addAdapter(seaportAdapter.address));
    waitForTx(await downpayment.updateFee(seaportAdapter.address, fee));
  });

task("deploy:looksRareExchangeAdapter", "Deploy looksRareExchangeAdapter")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;

    const looksRareExchange = getParams(LooksRareExchange, networkName)[0];
    const downpayment = await getContractFromDB("Downpayment");
    const looksRareExchangeAdapter = await deployProxyContract(
      "LooksRareExchangeAdapter",
      [downpayment.address, looksRareExchange],
      true
    );
    waitForTx(await downpayment.addAdapter(looksRareExchangeAdapter.address));
    waitForTx(await downpayment.updateFee(looksRareExchangeAdapter.address, fee));
  });

task("deploy:bendExchangeAdapter", "Deploy bendExchangeAdapter")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;

    const bendExchange = getParams(BendExchange, networkName)[0];
    const downpayment = await getContractFromDB("Downpayment");
    const bendExchangeAdapter = await deployProxyContract(
      "BendExchangeAdapter",
      [downpayment.address, bendExchange],
      true
    );
    waitForTx(await downpayment.addAdapter(bendExchangeAdapter.address));
    waitForTx(await downpayment.updateFee(bendExchangeAdapter.address, fee));
  });

task("deploy:openseaAdapter", "Deploy openseaAdapter")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;

    const openseaExchange = getParams(OpenseaExchange, networkName)[0];
    const downpayment = await getContractFromDB("Downpayment");
    const openseaAdapter = await deployProxyContract("OpenseaAdapter", [downpayment.address, openseaExchange], true);
    waitForTx(await downpayment.addAdapter(openseaAdapter.address));
    waitForTx(await downpayment.updateFee(openseaAdapter.address, fee));
  });

task("deploy:punkAdapter", "Deploy punkAdapter")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;
    const punkMarketParams = getParams(PunkMarket, networkName);
    const punkMarket = punkMarketParams[0];
    const wrappedPunk = punkMarketParams[1];
    const downpayment = await getContractFromDB("Downpayment");
    const punkAdapter = await deployProxyContract("PunkAdapter", [downpayment.address, punkMarket, wrappedPunk], true);
    waitForTx(await downpayment.addAdapter(punkAdapter.address));
    waitForTx(await downpayment.updateFee(punkAdapter.address, fee));
  });
