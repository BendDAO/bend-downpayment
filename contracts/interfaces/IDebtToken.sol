// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDebtToken is IERC20 {
    /**
     * @dev delegates borrowing power to a user on the specific debt token
     * @param delegatee the address receiving the delegated borrowing power
     * @param amount the maximum amount being delegated. Delegation will still
     * respect the liquidation constraints (even if delegated, a delegatee cannot
     * force a delegator HF to go below 1)
     **/
    function approveDelegation(address delegatee, uint256 amount) external;

    function scaledBalanceOf(address user) external view returns (uint256);
}
