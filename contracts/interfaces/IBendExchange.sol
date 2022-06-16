// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;
import {OrderTypes} from "../libraries/OrderTypes.sol";

interface IBendExchange {
    function matchAskWithTakerBidUsingETHAndWETH(
        OrderTypes.TakerOrder calldata takerBid,
        OrderTypes.MakerOrder calldata makerAsk
    ) external payable;

    function authorizationManager() external view returns (address);
}
