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

export const BAYC: Params<string> = {
  [Network.rinkeby]: "0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e",
  [Network.main]: "0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6",
};

export const OpenseaExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0xdd54d660178b28f6033a953b0e55073cfa7e3744", // OpenseaExchange
    "0x45B594792a5CDc008D0dE1C1d69FAA3D16B3DDc1", // MerkleValidator
  ],
  [Network.main]: [],
};

export const BendExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0x4F8A1d36C7B8386a659410e1C9839fa3c2339BE5", // BendExchange
    "0x43a851160dE8b03D633ceae07321b5e236aBaBbB", // StrategyStandardSaleForFixedPrice
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
    "0x7fE857748dc8e335E3E94cAFE27a63d1F573dF45", // bBAYC
    "0x04af5eF6100E1025560Be50FF244CB31f60d08c2", // NFTOracle
  ],
  [Network.main]: [],
};
