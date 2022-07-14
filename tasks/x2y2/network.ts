import "dotenv/config";
import { getParams, Network as NETWORK, NETWORKS_RPC_URL, WETH, X2Y2 } from "../../test/config";
export type Network = "rinkeby";

export type NetworkMeta = {
  id: number;
  rpcUrl: string;
  marketContract: string;
  wethContract: string;
  apiBaseURL: string;
};

export const getNetworkMeta = (network: Network): NetworkMeta => {
  switch (network) {
    case "rinkeby":
      return {
        id: 4,
        rpcUrl: NETWORKS_RPC_URL[NETWORK.rinkeby],
        marketContract: getParams(X2Y2, "rinkeby")[0],
        wethContract: getParams(WETH, "rinkeby"),
        apiBaseURL: process.env.X2Y2_SERVER || "https://api.x2y2.org",
      };
  }
};
