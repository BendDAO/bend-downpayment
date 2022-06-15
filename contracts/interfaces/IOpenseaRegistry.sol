// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

interface IOpenseaRegistry {
    function proxies(address owner) external view returns (address);

    function registerProxy() external returns (address);
}
