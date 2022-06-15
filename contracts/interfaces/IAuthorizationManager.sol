// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

interface IAuthorizationManager {
    function revoked() external returns (bool);

    function authorizedAddress() external returns (address);

    function proxies(address owner) external returns (address);

    function revoke() external;

    function registerProxy() external returns (address);
}
