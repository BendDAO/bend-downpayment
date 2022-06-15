export enum Network {
  rinkeby = "rinkeby",
  main = "main",
}

export interface Params<T> {
  [Network.rinkeby]: T;
  [Network.main]: T;
  [network: string]: T;
}

export const getParams = <T>({ rinkeby, main }: Params<T>, network: string): T => {
  network = Network[network as keyof typeof Network];
  switch (network) {
    case Network.rinkeby:
      return rinkeby;
    case Network.main:
      return main;
    default:
      return rinkeby;
  }
};

const INFURA_KEY = process.env.INFURA_KEY || "";
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || "";

export const NETWORKS_RPC_URL: Params<string> = {
  [Network.rinkeby]: ALCHEMY_KEY
    ? `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
  [Network.main]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

export const WETH: Params<string> = {
  [Network.rinkeby]: "0xb49dBe8e2A5a140b3b810c33ac2ba4907A3CA95e",
  [Network.main]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

export const PunkMarket: Params<string[]> = {
  [Network.rinkeby]: [
    "0x6389eA3Cf6dE815ba76d7Cf4C6Db6A7093471bcb", // PunkMarket
    "0x74e4418A41169Fb951Ca886976ccd8b36968c4Ab", // WrappedPunk
  ],
  [Network.main]: [],
};

export const OpenseaExchange: Params<string> = {
  [Network.rinkeby]: "0xdd54d660178b28f6033a953b0e55073cfa7e3744", // OpenseaExchange
  [Network.main]: "",
};

export const BendExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0xeF325442a539296f6A77cF746bdF7BC5357Bf21e", // BendExchange
    "0xb08D5cc233731599d57Ef652150C4bD6C587EB7D", // StrategyStandardSaleForFixedPrice
  ],
  [Network.main]: [],
};

export const BendProtocol: Params<string[]> = {
  [Network.rinkeby]: [
    "0xE55870eBB007a50B0dfAbAdB1a21e4bFcee5299b", // addresses provider
    "0x7A02EE743Aadca63d60945971B7eD12c7f26b6d2", // bend collector
    "0x6D9BcB420F217c4e1c3F1b8753C47b1E8A85eA1E", // debtWETH
    "0xeb7f1c5548faff6492b298082691a633fb2c5f4d", // bWETH
    "0x8894215794f196018324d191a03ef987A617eb01", // bWPUNK
  ],
  [Network.main]: [],
};
