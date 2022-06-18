// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

interface ILooksRareTransferSelectorNFT {
    function checkTransferManagerForToken(address collection) external view returns (address transferManager);
}
