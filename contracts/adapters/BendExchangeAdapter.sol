// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

import {IBendExchange} from "../interfaces/IBendExchange.sol";
import {IAuthorizationManager} from "../interfaces/IAuthorizationManager.sol";

import {PercentageMath} from "../libraries/PercentageMath.sol";

import {BaseAdapter} from "./BaseAdapter.sol";

contract BendExchangeAdapter is BaseAdapter {
    using PercentageMath for uint256;

    string public constant NAME = "Bend Exchange Downpayment Buy Adapter";
    string public constant VERSION = "1.0";

    //keccak256("Params(bool isOrderAsk,address maker,address collection,uint256 price,uint256 tokenId,uint256 amount,address strategy,address currency,uint256 nonce,uint256 startTime,uint256 endTime,uint256 minPercentageToAsk,bytes params,address interceptor,bytes interceptorExtra,uint8 makerV,bytes32 makerR,bytes32 makerS,uint256 takerPrice,uint256 takerTokenId,uint256 takerMinPercentageToAsk,bytes takerParams,uint256 nonce2");
    bytes32 private constant _PARAMS_TYPEHASH = 0x6eca5e6e6da9bbac63bee6c0c0f3c95ff7a7fd314ce8335388b394b5ce4cdd81;

    IBendExchange public bendExchange;
    address public fixedPriceStrategy;

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
        address interceptor;
        bytes interceptorExtra;
        // maker sig
        uint8 makerV;
        bytes32 makerR;
        bytes32 makerS;
        // taker order
        uint256 takerPrice;
        uint256 takerTokenId;
        bytes takerParams;
        // params sig
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function initialize(
        address _downpayment,
        address _bendExchange,
        address _fixedPriceStrategy
    ) external initializer {
        __BaseAdapter_init(NAME, VERSION, _downpayment);

        bendExchange = IBendExchange(_bendExchange);
        fixedPriceStrategy = _fixedPriceStrategy;
        address proxy = IAuthorizationManager(bendExchange.authorizationManager()).registerProxy();
        downpayment.WETH().approve(proxy, type(uint256).max);
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
        require(_orderParams.isOrderAsk, "Maker must ask order");
        require(
            _orderParams.currency == address(downpayment.WETH()) || _orderParams.currency == address(0),
            "Currency must be ETH or WETH"
        );
        require(_orderParams.strategy == fixedPriceStrategy, "Strategy must be fiexed price");
        require(_orderParams.price == _orderParams.takerPrice, "Price must be same");
        require(_orderParams.tokenId == _orderParams.takerTokenId, "Token id must be same");

        return
            BaseParams({
                nftAsset: _orderParams.collection,
                nftTokenId: _orderParams.tokenId,
                salePrice: _orderParams.price,
                paramsHash: _hashParams(_orderParams, _nonce),
                v: _orderParams.v,
                r: _orderParams.r,
                s: _orderParams.s
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
                    abi.encode(
                        keccak256(_orderParams.params),
                        _orderParams.interceptor,
                        keccak256(_orderParams.interceptorExtra),
                        _orderParams.makerV,
                        _orderParams.makerR,
                        _orderParams.makerS,
                        _orderParams.takerPrice,
                        _orderParams.takerTokenId,
                        keccak256(_orderParams.takerParams),
                        _nonce
                    )
                )
            );
    }

    function _exchange(BaseParams memory, bytes memory _params) internal override {
        Params memory _orderParams = _decodeParams(_params);
        IBendExchange.TakerOrder memory takerBid;
        {
            takerBid.isOrderAsk = false;
            takerBid.taker = address(this);
            takerBid.price = _orderParams.takerPrice;
            takerBid.tokenId = _orderParams.takerTokenId;
            takerBid.minPercentageToAsk = 0;
            takerBid.params = _orderParams.takerParams;
            takerBid.interceptor = address(0);
            takerBid.interceptorExtra = new bytes(0);
        }
        IBendExchange.MakerOrder memory makerAsk;
        {
            makerAsk.isOrderAsk = _orderParams.isOrderAsk;
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
            makerAsk.interceptor = _orderParams.interceptor;
            makerAsk.interceptorExtra = _orderParams.interceptorExtra;
            makerAsk.v = _orderParams.makerV;
            makerAsk.r = _orderParams.makerR;
            makerAsk.s = _orderParams.makerS;
        }
        bendExchange.matchAskWithTakerBidUsingETHAndWETH(takerBid, makerAsk);
    }

    function _decodeParams(bytes memory _params) internal pure returns (Params memory) {
        return abi.decode(_params, (Params));
    }
}
