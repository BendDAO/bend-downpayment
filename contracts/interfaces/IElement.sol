// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

interface IElement {

    struct Fee {
        address recipient;
        uint256 amount;
        bytes feeData;
    }

    struct NFTSellOrder {
        address maker;
        address taker;
        uint256 expiry;
        uint256 nonce;
        address erc20Token;
        uint256 erc20TokenAmount;
        Fee[] fees;
        address nft;
        uint256 nftId;
    }

    enum SignatureType {
        EIP712,
        PRESIGNED
    }

    struct Signature {
        // How to validate the signature.
        SignatureType signatureType;
        // EC Signature data.
        uint8 v;
        // EC Signature data.
        bytes32 r;
        // EC Signature data.
        bytes32 s;
    }

    struct Parameters {
        NFTSellOrder order;
        Signature sig;
    }

    /// @dev Buys an ERC721 asset by filling the given order.
    /// @param sellOrder The ERC721 sell order.
    /// @param signature The order signature.
    function buyERC721(NFTSellOrder calldata sellOrder, Signature calldata signature) external payable;
}
