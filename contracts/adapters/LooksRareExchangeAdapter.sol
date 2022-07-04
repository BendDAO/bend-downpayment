// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

import {ILooksRareExchange} from "../interfaces/ILooksRareExchange.sol";
import {IAuthorizationManager} from "../interfaces/IAuthorizationManager.sol";

import {BaseAdapter} from "./BaseAdapter.sol";

contract LooksRareExchangeAdapter is BaseAdapter {
    string public constant NAME = "LooksRare Exchange Downpayment Adapter";
    string public constant VERSION = "1.0";

    //keccak256("Params(bool isOrderAsk,address maker,address collection,uint256 price,uint256 tokenId,uint256 amount,address strategy,address currency,uint256 nonce,uint256 startTime,uint256 endTime,uint256 minPercentageToAsk,uint8 v,bytes32 r,bytes32 s,uint256 nonce2)");
    bytes32 private constant _PARAMS_TYPEHASH = 0xde2bb92f4c0c7506ba089f73afcdd7897ba53fd353051a35edd51005fe40d59f;

    ILooksRareExchange public looksRareExchange;

    struct Params {
        // maker order
        bool isOrderAsk;
        address maker;
        address collection;
        uint256 price;
        uint256 tokenId;
        uint256 amount;
        address strategy;
        address currency;
        uint256 nonce;
        uint256 startTime;
        uint256 endTime;
        uint256 minPercentageToAsk;
        bytes params;
        // maker sig
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function initialize(address _downpayment, address _looksRareExchange) external initializer {
        __BaseAdapter_init(NAME, VERSION, _downpayment);
        looksRareExchange = ILooksRareExchange(_looksRareExchange);
    }

    function _checkParams(
        address,
        uint256,
        uint256,
        bytes memory _params,
        uint256 _nonce
    ) internal view override returns (BaseParams memory) {
        Params memory _orderParams = _decodeParams(_params);

        // Check order params
        require(_orderParams.isOrderAsk, "Adapter: maker must ask order");
        require(_orderParams.currency == address(downpayment.WETH()), "Adapter: currency must be WETH");
        return
            BaseParams({
                nftAsset: _orderParams.collection,
                nftTokenId: _orderParams.tokenId,
                salePrice: _orderParams.price,
                paramsHash: _hashParams(_orderParams, _nonce)
            });
    }

    function _hashParams(Params memory _orderParams, uint256 _nonce) internal pure returns (bytes32) {
        return
            keccak256(
                bytes.concat(
                    abi.encode(
                        _PARAMS_TYPEHASH,
                        _orderParams.isOrderAsk,
                        _orderParams.maker,
                        _orderParams.collection,
                        _orderParams.price,
                        _orderParams.tokenId,
                        _orderParams.amount,
                        _orderParams.strategy,
                        _orderParams.currency,
                        _orderParams.nonce,
                        _orderParams.startTime,
                        _orderParams.endTime,
                        _orderParams.minPercentageToAsk
                    ),
                    abi.encode(keccak256(_orderParams.params), _orderParams.v, _orderParams.r, _orderParams.s, _nonce)
                )
            );
    }

    function _exchange(BaseParams memory _baseParams, bytes memory _params) internal override {
        Params memory _orderParams = _decodeParams(_params);
        ILooksRareExchange.TakerOrder memory takerBid;
        {
            takerBid.isOrderAsk = false;
            takerBid.taker = address(this);
            takerBid.price = _orderParams.price;
            takerBid.tokenId = _orderParams.tokenId;
            takerBid.minPercentageToAsk = 0;
            takerBid.params = new bytes(0);
        }
        ILooksRareExchange.MakerOrder memory makerAsk;
        {
            makerAsk.isOrderAsk = _orderParams.isOrderAsk;
            makerAsk.maker = _orderParams.maker;
            makerAsk.collection = _orderParams.collection;
            makerAsk.price = _orderParams.price;
            makerAsk.tokenId = _orderParams.tokenId;
            makerAsk.amount = _orderParams.amount;
            makerAsk.strategy = _orderParams.strategy;
            makerAsk.currency = _orderParams.currency;
            makerAsk.nonce = _orderParams.nonce;
            makerAsk.startTime = _orderParams.startTime;
            makerAsk.endTime = _orderParams.endTime;
            makerAsk.minPercentageToAsk = _orderParams.minPercentageToAsk;
            makerAsk.params = _orderParams.params;
            makerAsk.v = _orderParams.v;
            makerAsk.r = _orderParams.r;
            makerAsk.s = _orderParams.s;
        }
        downpayment.WETH().approve(address(looksRareExchange), _baseParams.salePrice);
        looksRareExchange.matchAskWithTakerBidUsingETHAndWETH(takerBid, makerAsk);
        downpayment.WETH().approve(address(looksRareExchange), 0);
    }

    function _decodeParams(bytes memory _params) internal pure returns (Params memory) {
        return abi.decode(_params, (Params));
    }
}
