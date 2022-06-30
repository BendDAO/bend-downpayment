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
  WETH,
} from "../test/config";
import { deployContract, deployProxyContract, getContractFromDB, waitForTx } from "./utils/helpers";

task("deploy:full", "Deploy all contracts")
  .addParam("fee", "protocol fee")
  .setAction(async ({ fee }, { network, run }) => {
    await run("set-DRE");
    await run("compile");
    const networkName = network.name;

    // config
    const weth = getParams(WETH, networkName);
    const aaveAddressesProvider = getParams(AAVE, networkName);
    const feeCollector = getParams(FeeCollector, networkName);
    const bendAddressesProvider = getParams(BendProtocol, networkName)[0];

    const openseaExchange = getParams(OpenseaExchange, networkName)[0];
    const punkMarketParams = getParams(PunkMarket, networkName);
    const punkMarket = punkMarketParams[0];
    const wrappedPunk = punkMarketParams[1];
    const looksRareExchange = getParams(LooksRareExchange, networkName)[0];
    const bendExchange = getParams(BendExchange, networkName)[0];

    const downpayment = await deployContract(
      "Downpayment",
      [aaveAddressesProvider, bendAddressesProvider, feeCollector, weth],
      true
    );
    // const downpayment = await getContractFromDB("Downpayment");
    const bendExchangeAdapter = await deployProxyContract(
      "BendExchangeAdapter",
      [downpayment.address, bendExchange],
      true
    );
    const looksRareExchangeAdapter = await deployProxyContract(
      "LooksRareExchangeAdapter",
      [downpayment.address, looksRareExchange],
      true
    );
    const openseaAdapter = await deployProxyContract("OpenseaAdapter", [downpayment.address, openseaExchange], true);
    const punkAdapter = await deployProxyContract("PunkAdapter", [downpayment.address, punkMarket, wrappedPunk], true);

    waitForTx(await downpayment.addAdapter(punkAdapter.address));
    waitForTx(await downpayment.addAdapter(openseaAdapter.address));
    waitForTx(await downpayment.addAdapter(bendExchangeAdapter.address));
    waitForTx(await downpayment.addAdapter(looksRareExchangeAdapter.address));

    waitForTx(await downpayment.updateFee(punkAdapter.address, fee));
    waitForTx(await downpayment.updateFee(openseaAdapter.address, fee));
    waitForTx(await downpayment.updateFee(bendExchangeAdapter.address, fee));
    waitForTx(await downpayment.updateFee(looksRareExchangeAdapter.address, fee));
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
