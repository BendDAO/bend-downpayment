// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;
import {IENSReverseRegistrar} from "../interfaces/IENSReverseRegistrar.sol";

contract MockENSReverseRegistrar is IENSReverseRegistrar {
    function setName(string memory name) public pure override returns (bytes32) {
        return keccak256(abi.encode(name));
    }
}
