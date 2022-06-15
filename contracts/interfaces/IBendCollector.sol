// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

interface IBendCollector {
    function approve(
        address token,
        address recipient,
        uint256 amount
    ) external;

    function transfer(
        address token,
        address recipient,
        uint256 amount
    ) external;
}
