import "dotenv/config";
import { getParams, Network as NETWORK, NETWORKS_RPC_URL, WETH, X2Y2 } from "../../test/config";
export type Network = "goerli";

export type NetworkMeta = {
  id: number;
  rpcUrl: string;
  marketContract: string;
  wethContract: string;
  apiBaseURL: string;
};

export const getNetworkMeta = (network: Network): NetworkMeta => {
  switch (network) {
    case "goerli":
      return {
        id: 4,
        rpcUrl: NETWORKS_RPC_URL[NETWORK.goerli],
        marketContract: getParams(X2Y2, "goerli")[0],
        wethContract: getParams(WETH, "goerli"),
        apiBaseURL: process.env.X2Y2_SERVER || "https://api.x2y2.org",
      };
  }
};
