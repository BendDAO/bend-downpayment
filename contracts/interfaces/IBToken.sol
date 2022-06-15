// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBToken is IERC20 {
    function scaledBalanceOf(address user) external view returns (uint256);
}
