export enum Network {
  rinkeby = "rinkeby",
  main = "main",
}

export interface Params<T> {
  [Network.rinkeby]: T;
  [Network.main]: T;
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

export const FeeCollector: Params<string> = {
  [Network.rinkeby]: "0xcbb8a164d498e0c2312F0DDcF0a6Ee2F5bad983A",
  [Network.main]: "",
};

export const AAVE: Params<string> = {
  [Network.rinkeby]: "0xF89Ac2d8885eaB06a4F16B1c769a011FCb09061A", // address provider
  [Network.main]: "",
};

export const WETH: Params<string> = {
  [Network.rinkeby]: "0xc778417e063141139fce010982780140aa0cd5ab",
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
    "0xFeCfD28A068BcB9AAeB1c830870093B24750B076", // BendExchange
    "0xC2A7b92C31e8ADdA71e8AB8bfe23955053D508aB", // StrategyStandardSaleForFixedPrice
  ],
  [Network.main]: [],
};

export const LooksRareExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0x1AA777972073Ff66DCFDeD85749bDD555C0665dA", // LooksRareExchange
    "0x732319A3590E4fA838C111826f9584a9A2fDEa1a", // StrategyStandardSaleForFixedPrice
  ],
  [Network.main]: [],
};

export const BendProtocol: Params<string[]> = {
  [Network.rinkeby]: [
    "0xE55870eBB007a50B0dfAbAdB1a21e4bFcee5299b", // addresses provider
    "0x7A02EE743Aadca63d60945971B7eD12c7f26b6d2", // bend collector
    "0x054fc05030a65bb30671f28ea5d668f56e4970d7", // debtWETH
    "0x162f6ef816c8b03193c50852fffb570d97ceea2f", // bWETH
    "0x8894215794f196018324d191a03ef987A617eb01", // bWPUNK
    "0x7fE857748dc8e335E3E94cAFE27a63d1F573dF45", // bBAYC
    "0x04af5eF6100E1025560Be50FF244CB31f60d08c2", // NFTOracle
  ],
  [Network.main]: [],
};

export const Seaport: Params<string[]> = {
  [Network.rinkeby]: [
    "0x00000000006c3852cbef3e08e8df289169ede581", // exchange
    "0x00000000e88fe2628ebc5da81d2b3cead633e89e", // zone
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
    "0x00000000F9490004C11Cef243f5400493c00Ad63", // ConduitController
  ],
  [Network.main]: [
    "0x00000000006c3852cbef3e08e8df289169ede581", // exchange
    "0x004c00500000ad104d7dbd00e3ae0a5c00560c00", // zone
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
    "0x00000000F9490004C11Cef243f5400493c00Ad63", // ConduitController
  ],
};
