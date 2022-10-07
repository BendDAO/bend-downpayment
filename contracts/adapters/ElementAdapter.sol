// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

import {IElement} from "../interfaces/IElement.sol";

import {BaseAdapter} from "./BaseAdapter.sol";

contract ElementAdapter is BaseAdapter {
    string public constant NAME = "Element Exchange Downpayment Adapter";
    string public constant VERSION = "1.0";

    // keccak256(abi.encodePacked(
    //    "Params(NFTSellOrder order,Signature sig,uint256 nonce)",
    //    "Fee(address recipient,uint256 amount,bytes feeData)",
    //    "NFTSellOrder(address maker,address taker,uint256 expiry,uint256 nonce,address erc20Token,uint256 erc20TokenAmount,Fee[] fees,address nft,uint256 nftId)",
    //    "Signature(uint8 signatureType,uint8 v,bytes32 r,bytes32 s)"
    // ));
    bytes32 internal constant _PARAMS_TYPEHASH = 0x33c2e5412e78858926b099a13a8c332e17aede73517a79d5e18ce72cef665f6c;
    // keccak256(abi.encodePacked(
    //    "NFTSellOrder(address maker,address taker,uint256 expiry,uint256 nonce,address erc20Token,uint256 erc20TokenAmount,Fee[] fees,address nft,uint256 nftId)",
    //    "Fee(address recipient,uint256 amount,bytes feeData)"
    // ));
    bytes32 internal constant _NFT_SELLORDER_TYPEHASH = 0x9d1aaa9952a8508193d4a332091bfa913fb6c18d10c797a2da023badfe57b3a8;
    // keccak256("Fee(address recipient,uint256 amount,bytes feeData)");
    uint256 internal constant _FEE_TYPEHASH = 0xe68c29f1b4e8cce0bbcac76eb1334bdc1dc1f293a517c90e9e532340e1e94115;
    // keccak256("Signature(uint8 signatureType,uint8 v,bytes32 r,bytes32 s)");
    uint256 internal constant _SIGNATURE_TYPEHASH = 0x0bee231cdae65a4e0a3d848ab14178e7dc11c4d1b4fd40fd1ed6cda5f25e3c61;
    // keccak256("");
    bytes32 internal constant _EMPTY_ARRAY_KECCAK256 = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

    // Native token pseudo-address.
    address internal constant NATIVE_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 internal constant MAX_EXPIRY = (1 << 64) - 1;

    IElement public elementExchange;

    function initialize(address _downpayment, address _elementExchange) external initializer {
        __BaseAdapter_init(NAME, VERSION, _downpayment);
        elementExchange = IElement(_elementExchange);
    }

    function initWETH() external reinitializer(2) {
        __BaseAdapter_init(NAME, VERSION, address(downpayment));
    }

    function _checkParams(
        address,
        uint256,
        uint256,
        bytes memory _params,
        uint256 _nonce
    ) internal view override returns (BaseParams memory) {
        IElement.Parameters memory _orderParams = _decodeParams(_params);

        // Check order params
        require(
            _orderParams.order.erc20Token == NATIVE_TOKEN_ADDRESS || _orderParams.order.erc20Token == address(WETH),
            "Adapter: currency should be ETH or WETH"
        );
        require(_orderParams.order.expiry <= MAX_EXPIRY, "Adapter: expiry exceeds the maximum limit");
        require(_orderParams.sig.signatureType == IElement.SignatureType.EIP712, "Adapter: signature type must be EIP712");

        address currency = _orderParams.order.erc20Token == NATIVE_TOKEN_ADDRESS ? address(0) : _orderParams.order.erc20Token;

        // Calculate `salePrice`.
        uint256 salePrice = _orderParams.order.erc20TokenAmount;
        for (uint256 i; i < _orderParams.order.fees.length; ) {
            salePrice += _orderParams.order.fees[i].amount;
            unchecked { i++; }
        }

        return BaseParams({
            nftAsset : _orderParams.order.nft,
            nftTokenId : _orderParams.order.nftId,
            currency : currency,
            salePrice : salePrice,
            paramsHash : _hashParams(_orderParams, _nonce)
        });
    }

    function _hashParams(IElement.Parameters memory _orderParams, uint256 _nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                _PARAMS_TYPEHASH,
                _hashNFTSellOrder(_orderParams.order),
                _hashSignature(_orderParams.sig),
                _nonce
            ));
    }

    function _hashNFTSellOrder(IElement.NFTSellOrder memory order) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                _NFT_SELLORDER_TYPEHASH,
                order.maker,
                order.taker,
                order.expiry,
                order.nonce,
                order.erc20Token,
                order.erc20TokenAmount,
                _hashFees(order.fees),
                order.nft,
                order.nftId
            ));
    }

    function _hashFees(IElement.Fee[] memory fees) internal pure returns (bytes32 feesHash) {
        uint256 numFees = fees.length;
        if (numFees == 0) {
            feesHash = _EMPTY_ARRAY_KECCAK256;
        } else {
            bytes32[] memory feeStructHashArray = new bytes32[](numFees);
            for (uint256 i = 0; i < numFees; ) {
                feeStructHashArray[i] = keccak256(abi.encode(_FEE_TYPEHASH, fees[i].recipient, fees[i].amount, keccak256(fees[i].feeData)));
                unchecked { i++; }
            }
            assembly {
                feesHash := keccak256(add(feeStructHashArray, 32), mul(numFees, 32))
            }
        }
    }

    function _hashSignature(IElement.Signature memory sig) internal pure returns (bytes32) {
        return keccak256(abi.encode(
                _SIGNATURE_TYPEHASH,
                sig.signatureType,
                sig.v,
                sig.r,
                sig.s
            ));
    }

    function _exchange(BaseParams memory _baseParams, bytes memory _params) internal override {
        IElement.Parameters memory _orderParams = _decodeParams(_params);
        uint256 paymentValue = _baseParams.salePrice;
        if (_orderParams.order.erc20Token == NATIVE_TOKEN_ADDRESS) {
            WETH.withdraw(paymentValue);
            elementExchange.buyERC721{value : paymentValue}(_orderParams.order, _orderParams.sig);
        } else {
            WETH.approve(address(elementExchange), paymentValue);
            elementExchange.buyERC721(_orderParams.order, _orderParams.sig);
            WETH.approve(address(elementExchange), 0);
        }
    }

    function _decodeParams(bytes memory _params) internal pure returns (IElement.Parameters memory) {
        return abi.decode(_params, (IElement.Parameters));
    }
}
