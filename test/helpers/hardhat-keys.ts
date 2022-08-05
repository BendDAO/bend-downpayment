/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable node/no-missing-import */

/**
 * WARNING!! DO NOT USE IN PRODUCTION OR WITH ANY FUNDS.
 * THESE PUBLIC/PRIVATE KEYS COME FROM HARDHAT AND ARE PUBLICLY KNOWN.
 */
export async function findPrivateKey(publicKey: string): Promise<string> {
  switch (publicKey.toLowerCase()) {
    case "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266":
      return "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    case "0x70997970c51812dc3a010c7d01b50e0d17dc79c8":
      return "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

    case "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc":
      return "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

    case "0x90f79bf6eb2c4f870365e785982e1f101e93b906":
      return "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

    case "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65":
      return "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";

    case "0x71be63f3384f5fb98995898a86b02fb2426c5788":
      return "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82";

    default:
      try {
        // @ts-ignore
        const keys = await import("../../keys");
        return keys.findPrivateKey(publicKey);
      } catch (error) {
        throw new Error("No private key found");
      }
  }
}
