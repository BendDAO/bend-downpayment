/* eslint-disable node/no-extraneous-import */
import { TypedDataDomain } from "@ethersproject/abstract-signer";
import { Signature } from "@ethersproject/bytes";
import { BigNumber, utils, Wallet } from "ethers";
import { findPrivateKey } from "../helpers/hardhat-keys";
import {
  OrderParameters,
  OrderComponents,
  CreateInputItem,
  ConsiderationInputItem,
  Fee,
} from "@opensea/seaport-js/lib/types";
import { formatBytes32String } from "ethers/lib/utils";
import {
  SEAPORT_CONTRACT_NAME,
  SEAPORT_CONTRACT_VERSION,
  ItemType,
  OrderType,
  BasicOrderRouteType,
} from "@opensea/seaport-js/lib/constants";
import {
  mapInputItemToOfferItem,
  generateRandomSalt,
  deductFees,
  feeToConsiderationItem,
  totalItemsAmount,
} from "@opensea/seaport-js/lib/utils/order";
import { isCurrencyItem } from "@opensea/seaport-js/lib/utils/item";
import { ISeaport } from "../../typechain-types/contracts/interfaces/ISeaport";

export { OrderParameters, ItemType, OrderType };

const offerAndConsiderationFulfillmentMapping: {
  [_key in ItemType]?: { [_key in ItemType]?: BasicOrderRouteType };
} = {
  [ItemType.ERC20]: {
    [ItemType.ERC721]: BasicOrderRouteType.ERC721_TO_ERC20,
    [ItemType.ERC1155]: BasicOrderRouteType.ERC1155_TO_ERC20,
  },
  [ItemType.ERC721]: {
    [ItemType.NATIVE]: BasicOrderRouteType.ETH_TO_ERC721,
    [ItemType.ERC20]: BasicOrderRouteType.ERC20_TO_ERC721,
  },
  [ItemType.ERC1155]: {
    [ItemType.NATIVE]: BasicOrderRouteType.ETH_TO_ERC1155,
    [ItemType.ERC20]: BasicOrderRouteType.ERC20_TO_ERC1155,
  },
} as const;

export const EIP_712_ORDER_TYPE = {
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
};

export const EIP_712_PARAM_TYPE = {
  Params: [
    { name: "considerationToken", type: "address" },
    { name: "considerationIdentifier", type: "uint256" },
    { name: "considerationAmount", type: "uint256" },
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offerToken", type: "address" },
    { name: "offerIdentifier", type: "uint256" },
    { name: "offerAmount", type: "uint256" },
    { name: "basicOrderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "offererConduitKey", type: "bytes32" },
    { name: "fulfillerConduitKey", type: "bytes32" },
    { name: "totalOriginalAdditionalRecipients", type: "uint256" },
    { name: "additionalRecipients", type: "AdditionalRecipient[]" },
    { name: "signature", type: "bytes" },
    { name: "nonce", type: "uint256" },
  ],
  AdditionalRecipient: [
    { name: "amount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
};
const EXCHANGE_ADAPTER_NAME = "Seaport Downpayment Adapter";
const EXCHANGE_ADAPTER_VERSION = "1.0";

const { defaultAbiCoder } = utils;

export type CreateOrderInput = {
  offerer: string;
  orderType: OrderType;
  conduitKey: string;
  zone: string;
  startTime: BigNumber;
  endTime: BigNumber;
  offer: CreateInputItem;
  consideration: ConsiderationInputItem;
  fees: readonly Fee[];
  nonce: BigNumber;
};

export const createOrder = async (input: CreateOrderInput): Promise<OrderParameters> => {
  const offerItems = [mapInputItemToOfferItem(input.offer)];
  const considerationItems = [
    {
      ...mapInputItemToOfferItem(input.consideration),
      recipient: input.consideration.recipient ?? input.offerer,
    },
  ];
  const currencies = [...offerItems, ...considerationItems].filter(isCurrencyItem);

  const totalCurrencyAmount = totalItemsAmount(currencies);
  const considerationItemsWithFees = [
    ...deductFees(considerationItems, input.fees),
    ...(currencies.length
      ? input.fees?.map((fee) =>
          feeToConsiderationItem({
            fee,
            token: currencies[0].token,
            baseAmount: totalCurrencyAmount.startAmount,
            baseEndAmount: totalCurrencyAmount.endAmount,
          })
        ) ?? []
      : []),
  ];
  return {
    offerer: input.offerer,
    zone: input.zone,
    // TODO: Placeholder
    zoneHash: formatBytes32String(input.nonce.toString()),
    startTime: input.startTime,
    endTime: input.endTime,
    orderType: input.orderType,
    offer: offerItems,
    consideration: considerationItemsWithFees,
    totalOriginalConsiderationItems: considerationItemsWithFees.length,
    salt: generateRandomSalt(),
    conduitKey: input.conduitKey,
  };
};

export const signOrder = async (
  chainId: number,
  signerAddress: string,
  verifyingContract: string,
  order: OrderParameters,
  conduitKey: string,
  nonce: BigNumber
): Promise<ISeaport.BasicOrderParametersStruct> => {
  const signer = new Wallet(await findPrivateKey(signerAddress));

  const domainData = {
    name: SEAPORT_CONTRACT_NAME,
    version: SEAPORT_CONTRACT_VERSION,
    chainId,
    verifyingContract,
  };

  const orderComponents: OrderComponents = {
    ...order,
    counter: nonce.toNumber(),
  };

  // Use EIP-2098 compact signatures to save gas. https://eips.ethereum.org/EIPS/eip-2098
  const signature = utils.splitSignature(
    await signer._signTypedData(domainData, EIP_712_ORDER_TYPE, orderComponents)
  ).compact;
  const { offer, consideration } = order;
  const offerItem = offer[0];
  const [forOfferer, ...forAdditionalRecipients] = consideration;
  const basicOrderRouteType = offerAndConsiderationFulfillmentMapping[offerItem.itemType]?.[forOfferer.itemType];
  if (basicOrderRouteType === undefined) {
    throw new Error("Order parameters did not result in a valid basic fulfillment");
  }
  const additionalRecipients = forAdditionalRecipients.map(({ startAmount, recipient }) => ({
    amount: startAmount,
    recipient,
  }));

  return {
    considerationToken: forOfferer.token,
    considerationIdentifier: forOfferer.identifierOrCriteria,
    considerationAmount: forOfferer.endAmount,
    offerer: order.offerer,
    zone: order.zone,
    offerToken: offerItem.token,
    offerIdentifier: offerItem.identifierOrCriteria,
    offerAmount: offerItem.endAmount,
    //  Note the use of a "basicOrderType" enum;
    //  this represents both the usual order type as well as the "route"
    //  of the basic order (a simple derivation function for the basic order
    //  type is `basicOrderType = orderType + (4 * basicOrderRoute)`.)
    basicOrderType: order.orderType + 4 * basicOrderRouteType,
    startTime: order.startTime,
    endTime: order.endTime,
    zoneHash: order.zoneHash,
    salt: order.salt,
    offererConduitKey: order.conduitKey,
    fulfillerConduitKey: conduitKey,
    totalOriginalAdditionalRecipients: order.consideration.length - 1,
    additionalRecipients,
    signature: signature,
  } as ISeaport.BasicOrderParametersStruct;
};

export const signParams = async (
  chainId: number,
  signerAddress: string,
  verifyingContract: string,
  order: ISeaport.BasicOrderParametersStruct,
  nonce: BigNumber
): Promise<Signature> => {
  const domainData: TypedDataDomain = {
    name: EXCHANGE_ADAPTER_NAME,
    version: EXCHANGE_ADAPTER_VERSION,
    chainId,
    verifyingContract,
  };
  const signer = new Wallet(await findPrivateKey(signerAddress));
  const value = { ...order, nonce };
  const signature = await signer._signTypedData(domainData, EIP_712_PARAM_TYPE, value);
  return utils.splitSignature(signature);
};

export interface DataWithSignature {
  data: string;
  sig: Signature;
}

export async function createSignedFlashloanParams(
  chainId: number,
  signerAddress: string,
  verifyingContract: string,
  order: ISeaport.BasicOrderParametersStruct,
  nonce: BigNumber
): Promise<DataWithSignature> {
  const sig: Signature = await signParams(chainId, signerAddress, verifyingContract, order, nonce);
  const types =
    "(address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes)";

  const fees = order.additionalRecipients.map((i) => [i.amount, i.recipient]);
  const data = defaultAbiCoder.encode(
    [types],
    [
      [
        order.considerationToken,
        order.considerationIdentifier,
        order.considerationAmount,
        order.offerer,
        order.zone,
        order.offerToken,
        order.offerIdentifier,
        order.offerAmount,
        order.basicOrderType,
        order.startTime,
        order.endTime,
        order.zoneHash,
        order.salt,
        order.offererConduitKey,
        order.fulfillerConduitKey,
        order.totalOriginalAdditionalRecipients,
        fees,
        order.signature,
      ],
    ]
  );
  return { data, sig };
}
