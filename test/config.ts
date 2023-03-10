export enum Network {
  rinkeby = "rinkeby",
  mainnet = "mainnet",
}

export interface Params<T> {
  [Network.rinkeby]: T;
  [Network.mainnet]: T;
}

export const getParams = <T>({ rinkeby, mainnet }: Params<T>, network: string): T => {
  network = Network[network as keyof typeof Network];
  switch (network) {
    case Network.rinkeby:
      return rinkeby;
    case Network.mainnet:
      return mainnet;
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
  [Network.mainnet]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

export const FeeCollector: Params<string> = {
  [Network.rinkeby]: "0xab576dAab2F1eB5417E1064EaBDe801af934D0e7",
  [Network.mainnet]: "0xDfB8Aff6642AE9Bc1612E3723178409a197C9770",
};

export const AAVE: Params<string> = {
  [Network.rinkeby]: "0xF89Ac2d8885eaB06a4F16B1c769a011FCb09061A", // address provider
  [Network.mainnet]: "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5", // address provider
};

export const WETH: Params<string> = {
  [Network.rinkeby]: "0xc778417e063141139fce010982780140aa0cd5ab",
  [Network.mainnet]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

export const PunkMarket: Params<string[]> = {
  [Network.rinkeby]: [
    "0x6389eA3Cf6dE815ba76d7Cf4C6Db6A7093471bcb", // PunkMarket
    "0x74e4418A41169Fb951Ca886976ccd8b36968c4Ab", // WrappedPunk
  ],
  [Network.mainnet]: [
    "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb", // PunkMarket
    "0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6", // WrappedPunk
  ],
};

export const BAYC: Params<string> = {
  [Network.rinkeby]: "0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e",
  [Network.mainnet]: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
};

export const OpenseaExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0xdd54d660178b28f6033a953b0e55073cfa7e3744", // OpenseaExchange
    "0x45B594792a5CDc008D0dE1C1d69FAA3D16B3DDc1", // MerkleValidator
  ],
  [Network.mainnet]: [
    "0x7f268357A8c2552623316e2562D90e642bB538E5", // OpenseaExchange
    "0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7", // MerkleValidator
  ],
};

export const BendExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0xFeCfD28A068BcB9AAeB1c830870093B24750B076", // BendExchange
    "0xC2A7b92C31e8ADdA71e8AB8bfe23955053D508aB", // StrategyStandardSaleForFixedPrice
  ],
  [Network.mainnet]: [
    "0x7e832eC8ad6F66E6C9ECE63acD94516Dd7fC537A", // BendExchange
    "0x80d190Fa1b1bB5488baD69FD3A89bf52821d4CCA", // StrategyStandardSaleForFixedPrice
  ],
};

export const LooksRareExchange: Params<string[]> = {
  [Network.rinkeby]: [
    "0x1AA777972073Ff66DCFDeD85749bDD555C0665dA", // LooksRareExchange
    "0x732319A3590E4fA838C111826f9584a9A2fDEa1a", // StrategyStandardSaleForFixedPrice
  ],
  [Network.mainnet]: [
    "0x59728544b08ab483533076417fbbb2fd0b17ce3a", // LooksRareExchange
    "0x56244bb70cbd3ea9dc8007399f61dfc065190031", // StrategyStandardSaleForFixedPrice
  ],
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
  [Network.mainnet]: [
    "0x24451f47caf13b24f4b5034e1df6c0e401ec0e46", // addresses provider
    "0x43078AbfB76bd24885Fd64eFFB22049f92a8c495", // bend collector
    "0x87ddE3A3f4b629E389ce5894c9A1F34A7eeC5648", // debtWETH
    "0xeD1840223484483C0cb050E6fC344d1eBF0778a9", // bWETH
    "0x6c415673C79b31aCA38669AD9fb5cdb7012C0e8e", // bWPUNK
    "0xDBfD76AF2157Dc15eE4e57F3f942bB45Ba84aF24", // bBAYC
    "0x7C2A19e54e48718f6C60908a9Cff3396E4Ea1eBA", // NFTOracle
  ],
};

export const Seaport: Params<string[]> = {
  [Network.rinkeby]: [
    "0x00000000006c3852cbef3e08e8df289169ede581", // exchange
    "0x00000000e88fe2628ebc5da81d2b3cead633e89e", // zone
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
    "0x00000000F9490004C11Cef243f5400493c00Ad63", // ConduitController
  ],
  [Network.mainnet]: [
    "0x00000000006c3852cbef3e08e8df289169ede581", // exchange
    "0x004c00500000ad104d7dbd00e3ae0a5c00560c00", // zone
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
    "0x00000000F9490004C11Cef243f5400493c00Ad63", // ConduitController
  ],
};

export const Seaport14: Params<string[]> = {
  [Network.rinkeby]: [
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", // exchange
    "0x00000000e88fe2628ebc5da81d2b3cead633e89e", // zone
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
    "0x00000000F9490004C11Cef243f5400493c00Ad63", // ConduitController
  ],
  [Network.mainnet]: [
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", // exchange
    "0x004c00500000ad104d7dbd00e3ae0a5c00560c00", // zone
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
    "0x00000000F9490004C11Cef243f5400493c00Ad63", // ConduitController
  ],
};

export const X2Y2: Params<string[]> = {
  [Network.rinkeby]: [
    "0x98ecc977f7a0ebebec6d01d63e87eeeefe9456b4", // X2Y2
    "0x88532a901475B3DdF370386AE22C2067846f7D7a", // ERC721Delegate
    "0xc84cd8960d7227320e96343e5694b6707fe92b6f", // owner
  ],
  [Network.mainnet]: [
    "0x74312363e45DCaBA76c59ec49a7Aa8A65a67EeD3", // X2Y2
    "0xf849de01b080adc3a814fabe1e2087475cf2e354", // ERC721Delegate
    "0x5d7cca9fb832bbd99c8bd720ebda39b028648301", // owner
  ],
};
