export enum Network {
  goerli = "goerli",
  mainnet = "mainnet",
}

export interface Params<T> {
  [Network.goerli]: T;
  [Network.mainnet]: T;
}

export const getParams = <T>({ goerli, mainnet }: Params<T>, network: string): T => {
  network = Network[network as keyof typeof Network];
  switch (network) {
    case Network.goerli:
      return goerli;
    case Network.mainnet:
      return mainnet;
    default:
      return goerli;
  }
};

const INFURA_KEY = process.env.INFURA_KEY || "";
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || "";

export const NETWORKS_RPC_URL: Params<string> = {
  [Network.goerli]: ALCHEMY_KEY
    ? `https://eth-goerli.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://goerli.infura.io/v3/${INFURA_KEY}`,
  [Network.mainnet]: ALCHEMY_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

export const FeeCollector: Params<string> = {
  [Network.goerli]: "0x3C9f44Dac66d56DcD8dFb4bC361AA4b72aCA8C08",
  [Network.mainnet]: "0xDfB8Aff6642AE9Bc1612E3723178409a197C9770",
};

export const AAVE: Params<string> = {
  [Network.goerli]: "0x8beFfFcECA4b9f0E29C1e89792d0782F51287979", // address provider
  [Network.mainnet]: "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5", // address provider
};

export const WETH: Params<string> = {
  [Network.goerli]: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  [Network.mainnet]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

export const USDT: Params<string> = {
  [Network.goerli]: "0x8096Fd3B381164af8421F25c84063B8afC637fE5",
  [Network.mainnet]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
};

export const PunkMarket: Params<string[]> = {
  [Network.goerli]: [
    "0xBccC7a1E79215EC3FD36824615801BCeE0Df2eC3", // PunkMarket
    "0xbeD1e8B430FD512b82A18cb121a8442F3889E505", // WrappedPunk
  ],
  [Network.mainnet]: [
    "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb", // PunkMarket
    "0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6", // WrappedPunk
  ],
};

export const BAYC: Params<string> = {
  [Network.goerli]: "0x30d190032A34d6151073a7DB8793c01Aa05987ec",
  [Network.mainnet]: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
};

export const BendExchange: Params<string[]> = {
  [Network.goerli]: [
    "0xA897599f8dAf1170b6e1391f1De66f69BAB9617F", // BendExchange
    "0x2B72aA8191C674734668b7A6459e3314e786cB10", // StrategyStandardSaleForFixedPrice
  ],
  [Network.mainnet]: [
    "0x7e832eC8ad6F66E6C9ECE63acD94516Dd7fC537A", // BendExchange
    "0x80d190Fa1b1bB5488baD69FD3A89bf52821d4CCA", // StrategyStandardSaleForFixedPrice
  ],
};

export const LooksRareExchange: Params<string[]> = {
  [Network.goerli]: [
    "0xD112466471b5438C1ca2D218694200e49d81D047", // LooksRareExchange
    "0xc771c0A3a7d738A1E12Aa88829A658bAefb32f0f", // StrategyStandardSaleForFixedPrice
  ],
  [Network.mainnet]: [
    "0x59728544b08ab483533076417fbbb2fd0b17ce3a", // LooksRareExchange
    "0x56244bb70cbd3ea9dc8007399f61dfc065190031", // StrategyStandardSaleForFixedPrice
  ],
};

export const BendProtocol: Params<string[]> = {
  [Network.goerli]: [
    "0x1cba0A3e18be7f210713c9AC9FE17955359cC99B", // addresses provider
    "0x32B08f895d93a207e8A5C9405870D780A43b25Dd", // bend collector
    "0x9aB83A4886dCE3C0c1011f9D248249DD3eF64784", // debtWETH
    "0x57FEbd640424C85b72b4361fE557a781C8d2a509", // bWETH
    "0x83f90CF9c281636a0128614EA043b5d8Ccd380fa", // bWPUNK
    "0x529710d1e2ab61bDea707039bB841583A983b228", // bBAYC
    "0xE7E268cC1D025906fe8f6b076ecc40FF1a8dfA61", // NFTOracle
    "0xdCc531F4543aB083a2948E23c732F31d5153677D", // debtUSDT
  ],
  [Network.mainnet]: [
    "0x24451f47caf13b24f4b5034e1df6c0e401ec0e46", // addresses provider
    "0x43078AbfB76bd24885Fd64eFFB22049f92a8c495", // bend collector
    "0x87ddE3A3f4b629E389ce5894c9A1F34A7eeC5648", // debtWETH
    "0xeD1840223484483C0cb050E6fC344d1eBF0778a9", // bWETH
    "0x6c415673C79b31aCA38669AD9fb5cdb7012C0e8e", // bWPUNK
    "0xDBfD76AF2157Dc15eE4e57F3f942bB45Ba84aF24", // bBAYC
    "0x7C2A19e54e48718f6C60908a9Cff3396E4Ea1eBA", // NFTOracle
    "0x02716c55f49a9107467507b82f9889480949afe4", // debtUSDT
  ],
};

export const Seaport14: Params<string[]> = {
  [Network.goerli]: [
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", // exchange
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
  ],
  [Network.mainnet]: [
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", // exchange
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
  ],
};

export const Seaport15: Params<string[]> = {
  [Network.goerli]: [
    "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", // exchange
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
  ],
  [Network.mainnet]: [
    "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", // exchange
    "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000", // OPENSEA_CONDUIT_KEY
    "0x1e0049783f008a0085193e00003d00cd54003c71", // OPENSEA_CONDUIT_ADDRESS
  ],
};

export const X2Y2: Params<string[]> = {
  [Network.goerli]: [
    "0x0000000000000000000000000000000000000000", // X2Y2
    "0x0000000000000000000000000000000000000000", // ERC721Delegate
    "0x0000000000000000000000000000000000000000", // owner
  ],
  [Network.mainnet]: [
    "0x74312363e45DCaBA76c59ec49a7Aa8A65a67EeD3", // X2Y2
    "0xf849de01b080adc3a814fabe1e2087475cf2e354", // ERC721Delegate
    "0x5d7cca9fb832bbd99c8bd720ebda39b028648301", // owner
  ],
};
