// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { FractionalizationPriceUtils as Utils } from "./utils/FractionalizationPriceUtils.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ILaunchpad } from "./interfaces/ILaunchpad.sol";
import { IBondingCurveModel } from "./plugins/interfaces/IBondingCurveModel.sol";
import { ILiquidityMigrator } from "./plugins/interfaces/ILiquidityMigrator.sol";
import { ILaunchpadHook } from "./plugins/interfaces/ILaunchpadHook.sol";
import { IFractionalToken } from "./interfaces/IFractionalToken.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// solhint-disable max-states-count
contract DomaLaunchpad is AccessControl, ILaunchpad, Initializable {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IFractionalToken;

    struct LiquidityPoolConfig {
        /// @notice The amount of the fractional tokens to provide into liquidity pool
        uint256 poolSupply;
        /// @notice The fee rate of the liquidity pool
        uint256 poolFeeBps;
        /// @notice The initial price of the liquidity pool
        uint256 poolInitialPriceWad;
        /// @notice The percentage limit below the target price for providing liquidity (or 0 for full range)
        /// @dev 2000 means '-20%' from target price
        uint256 poolLiquidityLowerRangePercentBps;
        /// @notice The percentage above below the target price for providing liquidity (or 0 for full range)
        /// @dev 2000 means '+20%' from target price
        uint256 poolLiquidityUpperRangePercentBps;
    }

    /// @notice Role that allows to set the fee rates
    bytes32 public constant SET_FEE_RATE_ROLE = keccak256("SET_FEE_RATE_ROLE");

    /// @notice Role that allows to perform emergency actions
    bytes32 public constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");

    uint256 public constant MAX_FEE_RATE_BPS = 7000; // 70%
    uint256 public constant MAX_FEE_ON_FAIL_RATE_BPS = 1000; // 10%
    uint256 public constant DENOMINATOR = 10000;
    uint256 public constant MIN_LAUNCH_DURATION = 1 days;

    /// @notice Token for sale
    IFractionalToken public fractionalToken;
    /// @notice Token used for buying/selling
    IERC20Metadata public quoteToken;

    /// @notice The total supply of the fractional token
    uint256 public totalSupply;

    /// @notice The amount of the fractional tokens to be sold using bonding curve (migration threshold)
    uint256 public launchSupply;

    /// @notice The address of the liquidity migrator to operate with liquidity pool
    ILiquidityMigrator public override liquidityMigrator;

    /// @notice Liquidity pool address for migration
    address public pool;

    LiquidityPoolConfig public liquidityPoolConfig;

    /// @notice Curve model for price calculations
    IBondingCurveModel public curveModel;

    /// @notice Hook contract to handle additional logic on buy/sell
    ILaunchpadHook public hook;
    /// @notice Hooks configuration
    ILaunchpadHook.EnabledHooks public hooksConfig;

    /// @notice The start time of the buy/sell functionality
    uint256 public launchStart;
    /// @notice The end time of the buy/sell functionality
    uint256 public launchEnd;

    /// @notice The address of the domain owner
    address public override domainOwner;

    /// @notice The wallet to receive fees and the leftovers
    address public buySellFeeRecipient;

    /// @notice Vesting wallet - Domain Owner wallet to receive fees and the leftovers
    address public vestingWallet;

    /// @notice The fee rate for buying fractional tokens (default 0)
    uint256 public buyFeeRateBps;
    /// @notice The fee rate for selling fractional tokens (default 0)
    uint256 public sellFeeRateBps;

    /// @notice Total amount of tokens sold
    uint256 internal _tokensSold;
    /// @notice Total amount of quote tokens received
    uint256 internal _quoteRaised;

    /// @notice The percentage of liquidity reserved for the liquidity pool
    uint128 internal _liquidityForPoolBps;

    /// @notice The percentage of the fees
    uint128 internal _migrationFeeBps;

    /// @notice The address of the recipient of the fees
    address internal _migrationFeeRecipient;

    /// @notice The timestamp indicating when the launchpad was migrated
    uint256 internal _migratedAt;

    /// @notice Amount of the domain owner proceeds
    uint256 internal _domainOwnerProceeds;

    /// @notice Trade lock status for pausing trading
    bool internal _tradeLocked;

    constructor() {
        _disableInitializers();
    }

    function initialize(LaunchParameters calldata _params) external initializer {
        if (
            address(_params.fractionalToken) == address(0) ||
            address(_params.quoteToken) == address(0) ||
            _params.curveModel == address(0) ||
            _params.liquidityMigrator == address(0) ||
            _params.vestingWallet == address(0) ||
            _params.domainOwner == address(0) ||
            _params.migrationFeeRecipient == address(0) ||
            _params.buySellFeeRecipient == address(0)
        ) {
            revert ZeroAddress();
        }

        if (_params.poolSupply == 0) {
            revert ZeroPoolSupply();
        }

        if (
            _params.launchStart >= _params.launchEnd ||
            _params.launchStart <= (block.timestamp - 30 minutes) ||
            _params.launchEnd - _params.launchStart < MIN_LAUNCH_DURATION
        ) {
            revert InvalidLaunchTime();
        }

        if (
            _params.poolLiquidityLowerRangePercentBps > DENOMINATOR ||
            _params.poolLiquidityUpperRangePercentBps > DENOMINATOR
        ) {
            revert InvalidLiquidityRange();
        }

        if (_params.blockTime == 0) revert ZeroBlockTime();

        // Store all launch parameters as variables
        fractionalToken = _params.fractionalToken;
        quoteToken = _params.quoteToken;
        totalSupply = _params.totalSupply;
        launchSupply = _params.launchSupply;

        liquidityPoolConfig = LiquidityPoolConfig({
            poolSupply: _params.poolSupply,
            poolFeeBps: _params.poolFeeBps,
            poolInitialPriceWad: Utils.priceToWAD(
                _params.poolInitialPrice,
                _params.fractionalToken,
                _params.quoteToken
            ),
            poolLiquidityLowerRangePercentBps: _params.poolLiquidityLowerRangePercentBps,
            poolLiquidityUpperRangePercentBps: _params.poolLiquidityUpperRangePercentBps
        });

        launchStart = _params.launchStart;
        launchEnd = _params.launchEnd;

        _liquidityForPoolBps = _params.liquidityForPoolBps;
        _migrationFeeBps = _params.migrationFeeBps;
        domainOwner = _params.domainOwner;

        _migrationFeeRecipient = _params.migrationFeeRecipient;
        buySellFeeRecipient = _params.buySellFeeRecipient;
        vestingWallet = _params.vestingWallet;

        sellFeeRateBps = _params.buySellFeeBps;
        buyFeeRateBps = _params.buySellFeeBps;

        // initialize bonding curve
        curveModel = IBondingCurveModel(_params.curveModel);
        IBondingCurveModel(_params.curveModel).initialize(
            address(_params.fractionalToken),
            address(_params.quoteToken),
            Utils.priceToWAD(_params.initialPrice, _params.fractionalToken, _params.quoteToken),
            Utils.priceToWAD(_params.finalPrice, _params.fractionalToken, _params.quoteToken),
            _params.launchSupply,
            _params.bondingCurveModelData
        );

        // initialize liquidity migrator
        liquidityMigrator = ILiquidityMigrator(_params.liquidityMigrator);
        ILiquidityMigrator(_params.liquidityMigrator).initialize(
            msg.sender,
            address(this),
            _params.blockTime,
            _params.liquidityMigratorData
        );
        pool = _createPool();

        // Lock transfers to the pool to prevent anyone from sending tokens before migration
        fractionalToken.lockTransfer(pool);

        // initialize hook
        if (_params.hook != address(0)) {
            hook = ILaunchpadHook(_params.hook);
            hooksConfig = ILaunchpadHook(_params.hook).getHooks();
            _grantRole(SET_FEE_RATE_ROLE, _params.hook);
        }

        // called by fractionalization contract
        _grantRole(EMERGENCY_ADMIN_ROLE, msg.sender);
    }

    modifier onlyWhenInProgress() {
        LaunchStatus status = _launchStatus();
        if (status != LaunchStatus.LAUNCHED) {
            revert LaunchNotInProgress();
        }
        _;
    }

    modifier onlyWhenFailed() {
        LaunchStatus status = _launchStatus();
        if (status != LaunchStatus.LAUNCH_FAILED) {
            revert LaunchNotFailed();
        }
        _;
    }

    modifier onlyDomainOwner() {
        if (msg.sender != domainOwner) revert NotAuthorized();
        _;
    }

    function launchStatus() external view override returns (LaunchStatus) {
        return _launchStatus();
    }

    function quoteRaised() external view returns (uint256) {
        return _quoteRaised;
    }

    function tokensSold() external view returns (uint256) {
        return _tokensSold;
    }

    function migrated() public view returns (bool) {
        return _migratedAt != 0;
    }

    function migratedAt() external view returns (uint256) {
        return _migratedAt;
    }

    function domainOwnerProceeds() external view returns (uint256) {
        return _domainOwnerProceeds;
    }

    function migrationPool() external view returns (address) {
        return pool;
    }

    function launchTokensSupply() external view returns (uint256) {
        return launchSupply;
    }

    function getAvailableTokensToBuy() external view override returns (uint256) {
        return launchSupply - _tokensSold;
    }

    /**
     * @notice Buy tokens from the bonding curve
     * @param quoteAmount Amount of quote tokens to spend
     * @param minTokenAmount Minimum amount of fractional tokens to receive (slippage protection)
     * @return tokenAmount The amount of tokens bought
     * @return quoteFeeAmount The amount of quote charged as fee
     */
    function buy(
        uint256 quoteAmount,
        uint256 minTokenAmount
    ) external override onlyWhenInProgress onlyWhenNotTradeLocked returns (uint256, uint256) {
        ILaunchpadHook.EnabledHooks memory hooks = hooksConfig;
        if (hooks.onBeforeBuy) {
            hook.onBeforeBuy(msg.sender, quoteAmount);
        }
        if (quoteAmount == 0) revert ZeroAmount();

        uint256 quoteFeeAmount = (quoteAmount * buyFeeRateBps) / DENOMINATOR;
        uint256 quoteAmountAfterFee = quoteAmount - quoteFeeAmount;
        // Calculate how many tokens can be bought with the given quote amount
        uint256 tokenAmount = curveModel.calculateBuyExactQuote(quoteAmountAfterFee, _tokensSold);

        // Check if we have enough tokens available for purchase
        if (_tokensSold + tokenAmount > launchSupply) {
            tokenAmount = launchSupply - _tokensSold;
            // Recalculate the actual quote amount needed for the available tokens
            quoteAmountAfterFee = curveModel.calculateBuyExactFractional(tokenAmount, _tokensSold);
            // Apply fee for updated amount
            quoteFeeAmount = (quoteAmountAfterFee * buyFeeRateBps) / (DENOMINATOR - buyFeeRateBps);
        }

        // Check slippage protection
        if (tokenAmount < minTokenAmount || tokenAmount == 0) {
            revert SlippageTooHigh(tokenAmount, minTokenAmount);
        }

        // !IMPORTANT
        // Update state before transferring tokens, to prevent potential reentrancy problem
        _tokensSold += tokenAmount;
        _quoteRaised += quoteAmountAfterFee;

        // Transfer quote tokens from buyer
        quoteToken.safeTransferFrom(msg.sender, address(this), quoteAmountAfterFee);
        // Transfer quote tokens from buyer
        quoteToken.safeTransferFrom(msg.sender, buySellFeeRecipient, quoteFeeAmount);
        // Transfer fractional tokens to buyer
        fractionalToken.safeTransfer(msg.sender, tokenAmount);

        // Make sure actual quote amount is emitted, as it can differ due to available supply limit
        uint256 effectiveQuoteAmount = quoteAmountAfterFee + quoteFeeAmount;

        if (hooks.onAfterBuy) {
            hook.onAfterBuy(msg.sender, effectiveQuoteAmount, tokenAmount);
        }

        emit TokensPurchased(msg.sender, tokenAmount, effectiveQuoteAmount, quoteFeeAmount);

        if (_tokensSold == launchSupply) {
            _migrate();
        }

        return (tokenAmount, quoteFeeAmount);
    }

    /**
     * @notice Sells the tokens for the quote tokens
     * @param tokenAmount The amount of tokens to sell
     * @param minQuoteAmount The minimum amount of quote tokens to receive
     * @return quoteAmountAfterFee The amount of quote tokens received
     * @return quoteFeeAmount The amount of quote tokens charged as fee
     */
    function sell(
        uint256 tokenAmount,
        uint256 minQuoteAmount
    ) external override onlyWhenInProgress onlyWhenNotTradeLocked returns (uint256, uint256) {
        if (tokenAmount == 0) revert ZeroAmount();

        ILaunchpadHook.EnabledHooks memory hooks = hooksConfig;
        if (hooks.onBeforeSell) {
            hook.onBeforeSell(msg.sender, tokenAmount);
        }

        uint256 quoteAmount = curveModel.calculateSellExactFractional(tokenAmount, _tokensSold);

        if (quoteAmount > _quoteRaised) {
            quoteAmount = _quoteRaised; // Safety check
        }

        uint256 quoteFeeAmount = (quoteAmount * sellFeeRateBps) / DENOMINATOR;
        uint256 quoteAmountAfterFee = quoteAmount - quoteFeeAmount;
        if (quoteAmountAfterFee < minQuoteAmount) {
            revert SlippageTooHigh(quoteAmount, minQuoteAmount);
        }

        // !IMPORTANT
        // Update state before transferring tokens, to prevent potential reentrancy problem
        _tokensSold -= tokenAmount;
        _quoteRaised -= quoteAmount; // reduce by full amount before fees

        // Transfer tokens from seller
        fractionalToken.safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Transfer quote tokens to seller
        quoteToken.safeTransfer(msg.sender, quoteAmountAfterFee);
        quoteToken.safeTransfer(buySellFeeRecipient, quoteFeeAmount);

        if (hooks.onAfterSell) {
            hook.onAfterSell(msg.sender, tokenAmount, quoteAmount);
        }

        emit TokensSold(msg.sender, tokenAmount, quoteAmountAfterFee, quoteFeeAmount);
        return (quoteAmountAfterFee, quoteFeeAmount);
    }

    /**
     * @dev We use it without slippage validations 'minQuoteAmount'.
     *      As price cannot go up at this point, it's always optimal to sell earlier.
     */
    function sellOnFail(
        uint256 tokenAmount
    ) external override onlyWhenFailed onlyWhenNotTradeLocked returns (uint256) {
        if (tokenAmount == 0) revert ZeroAmount();

        uint256 quoteAmount = curveModel.calculateSellExactFractional(tokenAmount, _tokensSold);
        if (quoteAmount > _quoteRaised) {
            quoteAmount = _quoteRaised; // Safety check
        }

        // !IMPORTANT
        // Update state before transferring tokens, to prevent potential reentrancy problem
        _tokensSold -= tokenAmount;
        _quoteRaised -= quoteAmount;

        // Burn the tokens directly (launchpad has BURN_MANAGER_ROLE)
        fractionalToken.burn(msg.sender, tokenAmount);

        // Transfer quote tokens to seller
        quoteToken.safeTransfer(msg.sender, quoteAmount);

        emit TokensSold(msg.sender, tokenAmount, quoteAmount, 0);
        return quoteAmount;
    }

    /**
     * @notice Set buy fee rate
     * @dev With the SET_FEE_RATE_ROLE role it can be triggered by the hook as well
     * @param _buyFeeRate New buy fee rate
     */
    function setBuyFeeRate(uint256 _buyFeeRate) external onlyRole(SET_FEE_RATE_ROLE) {
        if (_buyFeeRate > MAX_FEE_RATE_BPS) revert InvalidFeeRate();

        buyFeeRateBps = _buyFeeRate;
        emit BuyFeeRateSet(_buyFeeRate);
    }

    /**
     * @notice Set sell fee rate
     * @dev With the SET_FEE_RATE_ROLE role it can be triggered by the hook as well
     * @param _sellFeeRate New sell fee rate
     */
    function setSellFeeRate(uint256 _sellFeeRate) external onlyRole(SET_FEE_RATE_ROLE) {
        if (_sellFeeRate > MAX_FEE_RATE_BPS) revert InvalidFeeRate();
        sellFeeRateBps = _sellFeeRate;
        emit SellFeeRateSet(_sellFeeRate);
    }

    /**
     * @notice Withdraws the domain owner proceeds
     */
    function withdrawDomainOwnerProceeds() external override onlyDomainOwner {
        if (!migrated()) revert LaunchNotSucceeded();
        uint256 amount = _domainOwnerProceeds;
        if (amount == 0) return;

        // !IMPORTANT: update amounts before calling transfer, to prevent reentrancy attacks
        _domainOwnerProceeds = 0;

        quoteToken.safeTransfer(domainOwner, amount);

        emit ProceedsWithdrawn(domainOwner, amount);
    }

    /**
     * @dev Emergency function to withdraw quote tokens from the launchpad
     */
    function withdrawQuoteToken(
        address withdrawAddress,
        uint256 amount
    ) external onlyRole(EMERGENCY_ADMIN_ROLE) onlyWhenTradeLocked {
        if (withdrawAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        quoteToken.safeTransfer(withdrawAddress, amount);

        emit EmergencyQuoteWithdrawn(withdrawAddress, amount);
    }

    /**
     * @dev Emergency function to withdraw fractional tokens from the launchpad
     * @param withdrawAddress Address to receive the withdrawn tokens
     * @param amount Amount of fractional tokens to withdraw
     */
    function withdrawFractionalToken(
        address withdrawAddress,
        uint256 amount
    ) external onlyRole(EMERGENCY_ADMIN_ROLE) onlyWhenTradeLocked {
        if (withdrawAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        fractionalToken.safeTransfer(withdrawAddress, amount);

        emit EmergencyFractionalWithdrawn(withdrawAddress, amount);
    }

    /**
     * @dev Emergency function to lock or unlock trading on the launchpad
     * @param locked True to lock trading, false to unlock
     */
    function setTradeLockStatus(bool locked) external onlyRole(EMERGENCY_ADMIN_ROLE) {
        _tradeLocked = locked;
        emit TradeLockStatusChanged(locked);
    }

    /**
     * @dev Emergency function to adjust the launch end time
     * @param newLaunchEndTime New timestamp for when the launch period ends
     */
    function adjustLaunchEndTime(uint256 newLaunchEndTime) external onlyRole(EMERGENCY_ADMIN_ROLE) {
        if (newLaunchEndTime <= launchStart) revert InvalidLaunchTime();
        uint256 oldLaunchEnd = launchEnd;
        launchEnd = newLaunchEndTime;
        emit LaunchpadEndDateSet(oldLaunchEnd, newLaunchEndTime);
    }

    /**
     * @dev Emergency function to adjust the launch start time
     * @param newLaunchStartTime New timestamp for when the launch period starts
     */
    function adjustLaunchStartTime(
        uint256 newLaunchStartTime
    ) external onlyRole(EMERGENCY_ADMIN_ROLE) {
        if (newLaunchStartTime >= launchEnd) revert InvalidLaunchTime();
        uint256 oldLaunchStart = launchStart;
        launchStart = newLaunchStartTime;
        emit LaunchpadStartDateSet(oldLaunchStart, newLaunchStartTime);
    }

    modifier onlyWhenNotTradeLocked() {
        if (_tradeLocked) {
            revert LaunchpadPaused();
        }
        _;
    }

    modifier onlyWhenTradeLocked() {
        if (!_tradeLocked) {
            revert LaunchpadNotPaused();
        }
        _;
    }

    function _launchStatus() private view returns (LaunchStatus) {
        if (block.timestamp < launchStart) {
            return LaunchStatus.PRE_LAUNCH;
        }

        if (_tokensSold >= launchSupply) {
            return LaunchStatus.LAUNCH_SUCCEEDED;
        }

        if (block.timestamp <= launchEnd) {
            return LaunchStatus.LAUNCHED;
        }

        return LaunchStatus.LAUNCH_FAILED;
    }

    function _createPool() internal returns (address) {
        LiquidityPoolConfig memory poolConfig = liquidityPoolConfig;
        return
            liquidityMigrator.createPool(
                address(fractionalToken),
                address(quoteToken),
                uint24(poolConfig.poolFeeBps),
                poolConfig.poolInitialPriceWad
            );
    }

    /**
     * @dev Migrate liquidity to the Dex
     */
    function _migrate() internal {
        if (migrated()) revert AlreadyMigrated();
        _migratedAt = block.timestamp;

        LiquidityPoolConfig memory poolConfig = liquidityPoolConfig;

        // Calculate remaining quote tokens for liquidity
        uint256 liquidityQuoteAmount = (_quoteRaised * (_liquidityForPoolBps)) / DENOMINATOR;
        uint256 liquidityTokenAmount = poolConfig.poolSupply;

        // Calculate and send Doma fee
        uint256 migrationFee = (_quoteRaised * (_migrationFeeBps)) / DENOMINATOR;
        if (migrationFee > 0) {
            quoteToken.safeTransfer(_migrationFeeRecipient, migrationFee);
        }

        // Calculate domain owner proceeds
        _domainOwnerProceeds = _quoteRaised - liquidityQuoteAmount;

        if (migrationFee > _domainOwnerProceeds) {
            revert ILaunchpad.MigrationFeeExceedsProceeds(migrationFee, _domainOwnerProceeds);
        } else {
            _domainOwnerProceeds -= migrationFee;
        }

        // Unlock transfers to the pool before migration
        fractionalToken.unlockTransfer(pool);

        // Transfer all balances to the migrator
        quoteToken.safeTransfer(address(liquidityMigrator), liquidityQuoteAmount);
        fractionalToken.safeTransfer(address(liquidityMigrator), liquidityTokenAmount);

        (uint256 amount0Desired, uint256 amount1Desired) = quoteToken < fractionalToken
            ? (liquidityQuoteAmount, liquidityTokenAmount)
            : (liquidityTokenAmount, liquidityQuoteAmount);

        (
            uint256 lpTokenId,
            address token0,
            uint256 leftover0,
            address token1,
            uint256 leftover1
        ) = liquidityMigrator.migrate(amount0Desired, amount1Desired);

        if (token0 == address(quoteToken)) {
            IERC20Metadata(token0).safeTransfer(_migrationFeeRecipient, leftover0);
            IERC20Metadata(token1).safeTransfer(vestingWallet, leftover1);
        } else {
            IERC20Metadata(token1).safeTransfer(_migrationFeeRecipient, leftover1);
            IERC20Metadata(token0).safeTransfer(vestingWallet, leftover0);
        }

        emit LaunchMigrated(
            address(fractionalToken),
            pool,
            _tokensSold,
            _quoteRaised,
            liquidityTokenAmount,
            liquidityQuoteAmount,
            lpTokenId
        );
    }
}
