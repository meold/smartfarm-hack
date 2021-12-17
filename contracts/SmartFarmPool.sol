// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./mocks/ERC20Mock.sol";

contract SmartFarmPool is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebtToken1; // Reward debt token1
        uint256 rewardDebtToken2; // Reward debt token2
        uint256 rewardDebtToken3; // Reward debt token3
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 lastRewardBlock; // Last block number that tokens distribution occurs.
        uint256 accToken1PerShare; // Accumulated TOKEN1 per share, times 1e12. See below.
        uint256 accToken2PerShare; // Accumulated TOKEN2 per share, times 1e12. See below.
        uint256 accToken3PerShare; // Accumulated TOKEN3 per share, times 1e12. See below.
    }

    // Info of pool.
    PoolInfo public poolInfo;

    ERC20Mock public token1;
    ERC20Mock public token2;
    ERC20Mock public token3;

    // Info of each user that stakes LP tokens.
    mapping(address => UserInfo) public userInfo;

    // Token1 tokens created per block.
    uint256 public token1PerBlock;
    // Token2 tokens created per block.
    uint256 public token2PerBlock;
    // Token3 tokens created per block.
    uint256 public token3PerBlock;

    // The block number when tokens rewards starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(
        IERC20 _lpToken,
        ERC20Mock _token1,
        ERC20Mock _token2,
        ERC20Mock _token3,
        uint256 _token1PerBlock,
        uint256 _token2PerBlock,
        uint256 _token3PerBlock,
        uint256 _startBlock
    ) public {
        token1 = _token1;
        token2 = _token2;
        token3 = _token3;
        token1PerBlock = _token1PerBlock;
        token2PerBlock = _token2PerBlock;
        token3PerBlock = _token3PerBlock;
        startBlock = _startBlock;

        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;

        poolInfo = PoolInfo({
            lpToken: _lpToken,
            lastRewardBlock: lastRewardBlock,
            accToken1PerShare: 0,
            accToken2PerShare: 0,
            accToken3PerShare: 0
        });
    }

    // Update the pool's rewards. Can only be called by the owner.
    function set(
        uint256 _token1PerBlock,
        uint256 _token2PerBlock,
        uint256 _token3PerBlock
    ) public onlyOwner {
        token1PerBlock = _token1PerBlock;
        token2PerBlock = _token2PerBlock;
        token3PerBlock = _token3PerBlock;
    }

    // Return reward multiplier over the given _from to _to block.
    function getBlocksPassed(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        return _to.sub(_from);
    }

    function pendingTokens(address _user)
        external
        view
        returns (
            uint256 token1Pending,
            uint256 token2Pending,
            uint256 token3Pending
        )
    {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[_user];

        uint256 accToken1PerShare = pool.accToken1PerShare;
        uint256 accToken2PerShare = pool.accToken2PerShare;
        uint256 accToken3PerShare = pool.accToken3PerShare;

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 blocksPassed = getBlocksPassed(
                pool.lastRewardBlock,
                block.number
            );

            uint256 token1Reward = blocksPassed.mul(token1PerBlock);
            uint256 token2Reward = blocksPassed.mul(token2PerBlock);
            uint256 token3Reward = blocksPassed.mul(token3PerBlock);

            accToken1PerShare = accToken1PerShare.add(
                token1Reward.mul(1e12).div(lpSupply)
            );
            accToken2PerShare = accToken2PerShare.add(
                token2Reward.mul(1e12).div(lpSupply)
            );
            accToken3PerShare = accToken3PerShare.add(
                token3Reward.mul(1e12).div(lpSupply)
            );
        }

        token1Pending = user.amount.mul(accToken1PerShare).div(1e12).sub(
            user.rewardDebtToken1
        );
        token2Pending = user.amount.mul(accToken2PerShare).div(1e12).sub(
            user.rewardDebtToken2
        );
        token3Pending = user.amount.mul(accToken3PerShare).div(1e12).sub(
            user.rewardDebtToken3
        );
    }

    // Update reward variables of the pool to be up-to-date.
    function updatePool() public {
        PoolInfo storage pool = poolInfo;

        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 blocksPassed = getBlocksPassed(
            pool.lastRewardBlock,
            block.number
        );
        uint256 token1Reward = blocksPassed.mul(token1PerBlock);
        uint256 token2Reward = blocksPassed.mul(token2PerBlock);
        uint256 token3Reward = blocksPassed.mul(token3PerBlock);

        pool.accToken1PerShare = pool.accToken1PerShare.add(
            token1Reward.mul(1e12).div(lpSupply)
        );
        pool.accToken2PerShare = pool.accToken2PerShare.add(
            token2Reward.mul(1e12).div(lpSupply)
        );
        pool.accToken3PerShare = pool.accToken3PerShare.add(
            token3Reward.mul(1e12).div(lpSupply)
        );

        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens.
    function deposit(uint256 _amount) public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];

        updatePool();

        if (user.amount > 0) {
            uint256 pendingToken1 = user
                .amount
                .mul(pool.accToken1PerShare)
                .div(1e12)
                .sub(user.rewardDebtToken1);
            uint256 pendingToken2 = user
                .amount
                .mul(pool.accToken2PerShare)
                .div(1e12)
                .sub(user.rewardDebtToken2);
            uint256 pendingToken3 = user
                .amount
                .mul(pool.accToken3PerShare)
                .div(1e12)
                .sub(user.rewardDebtToken3);

            safeTokenTransfer(msg.sender, pendingToken1, token1);
            safeTokenTransfer(msg.sender, pendingToken2, token2);
            safeTokenTransfer(msg.sender, pendingToken3, token3);
        }

        pool.lpToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );

        user.amount = user.amount.add(_amount);
        user.rewardDebtToken1 = user.amount.mul(pool.accToken1PerShare).div(
            1e12
        );
        user.rewardDebtToken2 = user.amount.mul(pool.accToken2PerShare).div(
            1e12
        );
        user.rewardDebtToken3 = user.amount.mul(pool.accToken3PerShare).div(
            1e12
        );

        emit Deposit(msg.sender, _amount);
    }

    // Withdraw LP tokens.
    function withdraw(uint256 _amount) public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];

        require(user.amount >= _amount, "withdraw: not enought funds");

        updatePool();

        uint256 pendingToken1 = user
            .amount
            .mul(pool.accToken1PerShare)
            .div(1e12)
            .sub(user.rewardDebtToken1);
        uint256 pendingToken2 = user
            .amount
            .mul(pool.accToken2PerShare)
            .div(1e12)
            .sub(user.rewardDebtToken2);
        uint256 pendingToken3 = user
            .amount
            .mul(pool.accToken3PerShare)
            .div(1e12)
            .sub(user.rewardDebtToken3);

        safeTokenTransfer(msg.sender, pendingToken1, token1);
        safeTokenTransfer(msg.sender, pendingToken2, token2);
        safeTokenTransfer(msg.sender, pendingToken3, token3);

        user.amount = user.amount.sub(_amount);
        user.rewardDebtToken1 = user.amount.mul(pool.accToken1PerShare).div(
            1e12
        );
        user.rewardDebtToken2 = user.amount.mul(pool.accToken2PerShare).div(
            1e12
        );
        user.rewardDebtToken3 = user.amount.mul(pool.accToken3PerShare).div(
            1e12
        );

        pool.lpToken.safeTransfer(address(msg.sender), _amount);

        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, user.amount);
        user.amount = 0;
        user.rewardDebtToken1 = 0;
        user.rewardDebtToken2 = 0;
        user.rewardDebtToken3 = 0;
    }

    // Safe token transfer function, just in case if rounding error causes pool to not have enough token.
    function safeTokenTransfer(
        address _to,
        uint256 _amount,
        ERC20Mock token
    ) internal {
        uint256 tokenBalance = token.balanceOf(address(this));
        if (_amount > tokenBalance) {
            token.transfer(_to, tokenBalance);
        } else {
            token.transfer(_to, _amount);
        }
    }
}
