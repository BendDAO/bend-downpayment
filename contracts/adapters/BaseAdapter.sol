// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import {IAaveFlashLoanReceiver} from "../interfaces/IAaveFlashLoanReceiver.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {PercentageMath} from "../libraries/PercentageMath.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IDownpayment} from "../interfaces/IDownpayment.sol";

import "hardhat/console.sol";

abstract contract BaseAdapter is
    IAaveFlashLoanReceiver,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    ERC721HolderUpgradeable
{
    using PercentageMath for uint256;
    event FeeCharged(address indexed payer, address indexed adapter, uint256 fee);
    IDownpayment public downpayment;
    uint256[44] private __gap;

    function __BaseAdapter_init(
        string memory _name,
        string memory _version,
        address _downpayment
    ) internal onlyInitializing {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init_unchained(_name, _version);
        downpayment = IDownpayment(_downpayment);
        downpayment.WETH().approve(address(downpayment.getBendLendPool()), type(uint256).max);
    }

    struct BaseParams {
        address nftAsset;
        uint256 nftTokenId;
        uint256 salePrice;
        bytes32 paramsHash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
    struct LocalVars {
        address buyer;
        uint256 bendFeeAmount;
        uint256 buyerPayment;
        uint256 flashBorrowedAmount;
        uint256 flashFee;
        uint256 flashLoanDebt;
        uint256 nonce;
        bytes params;
    }

    // abstract functions
    function _checkParams(
        address _buyer,
        uint256 _flashBorrowedAmount,
        uint256 _flashFee,
        bytes memory _params,
        uint256 _nonce
    ) internal view virtual returns (BaseParams memory);

    function _exchange(BaseParams memory baseParams, bytes memory _params) internal virtual;

    // external functions
    function executeOperation(
        address[] calldata _assets,
        uint256[] calldata _amounts,
        uint256[] calldata _premiums,
        address _initiator,
        bytes calldata _params
    ) external override nonReentrant whenNotPaused returns (bool) {
        require(msg.sender == address(downpayment.getAaveLendPool()), "Caller must be aave lending pool");
        require(_initiator == address(downpayment), "Flashloan initiator must be downpayment");
        IWETH WETH = downpayment.WETH();
        uint256 fee = downpayment.getFee(address(this));
        require(_assets.length == 1 && _amounts.length == 1 && _premiums.length == 1, "Multiple assets not supported");
        require(_assets[0] == address(WETH), "Only WETH borrowing allowed");
        LocalVars memory vars;
        (vars.params, vars.buyer) = abi.decode(_params, (bytes, address));

        vars.flashBorrowedAmount = _amounts[0];
        vars.flashFee = _premiums[0];
        vars.nonce = downpayment.nonces(vars.buyer);

        BaseParams memory baseParams = _checkParams(
            vars.buyer,
            vars.flashBorrowedAmount,
            vars.flashFee,
            vars.params,
            vars.nonce
        );
        _checkSig(vars.buyer, baseParams.paramsHash, baseParams.v, baseParams.r, baseParams.s);

        require(vars.flashBorrowedAmount <= WETH.balanceOf(address(this)), "Insufficient flash loan");

        // Check if the flash loan can be paid off and payment sufficient
        vars.bendFeeAmount = baseParams.salePrice.percentMul(fee);

        vars.buyerPayment = vars.bendFeeAmount + vars.flashFee + baseParams.salePrice - vars.flashBorrowedAmount;
        require(
            WETH.balanceOf(vars.buyer) >= vars.buyerPayment &&
                WETH.allowance(vars.buyer, address(this)) >= vars.buyerPayment,
            "Insufficient balance"
        );

        vars.flashLoanDebt = vars.flashBorrowedAmount + vars.flashFee;

        // Prepare ETH, need buyer approve WETH to this contract
        require(WETH.transferFrom(vars.buyer, address(this), vars.buyerPayment), "WETH transfer failed");
        WETH.withdraw(baseParams.salePrice);

        // Do opensea exchange
        _exchange(baseParams, vars.params);

        _beforeBorrowWETH(baseParams.nftAsset, baseParams.nftTokenId, vars.buyer, vars.flashBorrowedAmount);

        // Borrow WETH from bend, need buyer approve NFT to this contract
        _borrowWETH(baseParams.nftAsset, baseParams.nftTokenId, vars.buyer, vars.flashBorrowedAmount);

        _afterBorrowWETH(baseParams.nftAsset, baseParams.nftTokenId, vars.buyer, vars.flashBorrowedAmount);

        // Charge fee, sent to bend collector
        _chargeFee(vars.buyer, vars.bendFeeAmount);

        // Repay flash loan
        _repayFlashLoan(vars.flashLoanDebt);
        return true;
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }

    function _chargeFee(address _payer, uint256 _amount) internal {
        if (_amount > 0) {
            downpayment.getBendLendPool().deposit(
                address(downpayment.WETH()),
                _amount,
                downpayment.getFeeCollector(),
                0
            );
            emit FeeCharged(_payer, address(this), _amount);
        }
    }

    function _beforeBorrowWETH(
        address _nftAsset,
        uint256 _nftTokenId,
        address _onBehalfOf,
        uint256 _amount
    ) internal virtual {}

    function _borrowWETH(
        address _nftAsset,
        uint256 _nftTokenId,
        address _onBehalfOf,
        uint256 _amount
    ) internal {
        ILendPool _pool = downpayment.getBendLendPool();
        IERC721Upgradeable _nftERC721 = IERC721Upgradeable(_nftAsset);

        require(_nftERC721.ownerOf(_nftTokenId) == address(this), "Not own nft");
        _nftERC721.approve(address(_pool), _nftTokenId);
        _pool.borrow(address(downpayment.WETH()), _amount, _nftAsset, _nftTokenId, _onBehalfOf, 0);
    }

    function _afterBorrowWETH(
        address _nftAsset,
        uint256 _nftTokenId,
        address _onBehalfOf,
        uint256 _amount
    ) internal virtual {}

    function _repayFlashLoan(uint256 _flashLoanDebt) internal {
        address aaveLendPool = address(downpayment.getAaveLendPool());
        downpayment.WETH().approve(aaveLendPool, 0);
        downpayment.WETH().approve(aaveLendPool, _flashLoanDebt);
    }

    function _checkSig(
        address _signer,
        bytes32 paramsHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        bytes32 hash = _hashTypedDataV4(paramsHash);
        address signer = ECDSAUpgradeable.recover(hash, v, r, s);
        require(signer == _signer, "Invalid signature");
    }

    /**
     * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
     */
    receive() external payable {
        require(msg.sender == address(downpayment.WETH()), "Receive not allowed");
    }
}
