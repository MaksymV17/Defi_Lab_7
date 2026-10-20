// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUniswapV2Router02} from "./interfaces/IUniswapV2Router02.sol";

/// @notice Сховище стандарту ERC-4626 з автокомпаундингом.
/// Інвестори вносять базовий актив (Токен А) і отримують акції (shares).
/// Винагорода (Токен Б) надходить на адресу сховища звичайним ERC-20 переказом.
/// Функція compound() продає її за Токен А через Uniswap V2, через що
/// totalAssets() зростає, а кожна акція дає право на більше базового активу.
contract AutoCompoundVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AutoCompoundVault__NoRewards();
    error AutoCompoundVault__SameToken();

    uint256 public constant SLIPPAGE_BPS = 500; // допустиме проковзування 5%
    uint256 private constant BPS = 10_000;

    IERC20 public immutable rewardToken;
    IUniswapV2Router02 public immutable router;

    event Compounded(uint256 rewardSold, uint256 assetsReceived);

    constructor(IERC20 asset_, IERC20 rewardToken_, address router_)
        ERC20("Auto Compound Vault Share", "acVS")
        ERC4626(asset_)
    {
        if (address(asset_) == address(rewardToken_)) revert AutoCompoundVault__SameToken();
        rewardToken = rewardToken_;
        router = IUniswapV2Router02(router_);
    }

    /// @notice Продає всю винагороду (Токен Б), що лежить на контракті, за базовий актив (Токен А).
    /// Може викликати будь-хто (наприклад, бот автоматизації).
    /// ПРИМІТКА: захист від проковзування тут рахується від спотової ціни пулу, для production
    /// краще використовувати ціну оракула або TWAP.
    function compound() external nonReentrant returns (uint256 assetsReceived) {
        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        if (rewardBalance == 0) revert AutoCompoundVault__NoRewards();

        address[] memory path = new address[](2);
        path[0] = address(rewardToken);
        path[1] = asset();

        uint256 expectedOut = router.getAmountsOut(rewardBalance, path)[1];
        uint256 minOut = (expectedOut * (BPS - SLIPPAGE_BPS)) / BPS;

        uint256 balanceBefore = IERC20(asset()).balanceOf(address(this));
        rewardToken.forceApprove(address(router), rewardBalance);
        router.swapExactTokensForTokens(rewardBalance, minOut, path, address(this), block.timestamp);
        assetsReceived = IERC20(asset()).balanceOf(address(this)) - balanceBefore;

        emit Compounded(rewardBalance, assetsReceived);
    }
}
