// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

import {ICryptoPunksMarket} from "../interfaces/ICryptoPunksMarket.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";

import {BaseAdapter} from "./BaseAdapter.sol";

contract PunkAdapter is BaseAdapter {
    string public constant NAME = "Punk Downpayment Adapter";
    string public constant VERSION = "1.0";

    bytes32 private constant _PARAMS_TYPEHASH = keccak256("Params(uint256 punkIndex,uint256 buyPrice,uint256 nonce)");

    ICryptoPunksMarket public punksMarket;
    IWrappedPunks public wrappedPunks;
    address public wpunkProxy;

    struct Params {
        uint256 punkIndex;
        uint256 buyPrice;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function initialize(
        address _downpayment,
        address _cryptoPunksMarket,
        address _wrappedPunks
    ) external initializer {
        __BaseAdapter_init(NAME, VERSION, _downpayment);

        punksMarket = ICryptoPunksMarket(_cryptoPunksMarket);
        wrappedPunks = IWrappedPunks(_wrappedPunks);
        wrappedPunks.registerProxy();
        wpunkProxy = wrappedPunks.proxyInfo(address(this));
    }

    function _checkParams(
        address,
        uint256,
        uint256,
        bytes memory _params,
        uint256 _nonce
    ) internal view override returns (BaseParams memory) {
        Params memory _orderParams = _decodeParams(_params);

        ICryptoPunksMarket.Offer memory _sellOffer = punksMarket.punksOfferedForSale(_orderParams.punkIndex);

        // Check order params
        require(_sellOffer.isForSale, "Punk not actually for sale");
        require(_orderParams.buyPrice == _sellOffer.minValue, "Order price must be same");
        require(_sellOffer.onlySellTo == address(0), "Order must sell to zero address");

        return
            BaseParams({
                nftAsset: address(wrappedPunks),
                nftTokenId: _orderParams.punkIndex,
                salePrice: _sellOffer.minValue,
                paramsHash: _hashParams(_orderParams, _nonce),
                v: _orderParams.v,
                r: _orderParams.r,
                s: _orderParams.s
            });
    }

    function _hashParams(Params memory _orderParams, uint256 _nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode(_PARAMS_TYPEHASH, _orderParams.punkIndex, _orderParams.buyPrice, _nonce));
    }

    function _exchange(BaseParams memory _baseParams, bytes memory _params) internal override {
        Params memory _orderParams = _decodeParams(_params);
        downpayment.WETH().withdraw(_baseParams.salePrice);
        punksMarket.buyPunk{value: _orderParams.buyPrice}(_orderParams.punkIndex);
    }

    function _beforeBorrowWETH(
        address _nftAsset,
        uint256 _nftTokenId,
        address _onBehalfOf,
        uint256 _amount
    ) internal override {
        _nftAsset;
        _nftTokenId;
        _onBehalfOf;
        _amount;

        require(address(wrappedPunks) == _nftAsset, "Not wpunks contract");
        require(punksMarket.punkIndexToAddress(_nftTokenId) == address(this), "Not owner of punkIndex");
        punksMarket.transferPunk(wpunkProxy, _nftTokenId);
        wrappedPunks.mint(_nftTokenId);
    }

    function _decodeParams(bytes memory _params) internal pure returns (Params memory) {
        return abi.decode(_params, (Params));
    }
}
