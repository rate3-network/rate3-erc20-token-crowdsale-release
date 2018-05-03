pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title RTEBonusTokenVault
 * @dev Token holder contract that releases tokens to the respective addresses
 * and _lockedReleaseTime
 */
contract RTEBonusTokenVault is Ownable {
  using SafeERC20 for ERC20Basic;
  using SafeMath for uint256;

  // ERC20 basic token contract being held
  ERC20Basic public token;

  bool public vaultUnlocked;

  bool public vaultSecondaryUnlocked;

  // How much we have allocated to the investors invested
  mapping(address => uint256) public balances;

  mapping(address => uint256) public lockedBalances;

  /**
   * @dev Allocation event
   * @param _investor Investor address
   * @param _value Tokens allocated
   */
  event Allocated(address _investor, uint256 _value);

  /**
   * @dev Distribution event
   * @param _investor Investor address
   * @param _value Tokens distributed
   */
  event Distributed(address _investor, uint256 _value);

  function RTEBonusTokenVault(
    ERC20Basic _token
  )
    public
  {
    token = _token;
    vaultUnlocked = false;
    vaultSecondaryUnlocked = false;
  }

  /**
   * @dev Unlocks vault
   */
  function unlock() public onlyOwner {
    require(!vaultUnlocked);
    vaultUnlocked = true;
  }

  /**
   * @dev Unlocks secondary vault
   */
  function unlockSecondary() public onlyOwner {
    require(vaultUnlocked);
    require(!vaultSecondaryUnlocked);
    vaultSecondaryUnlocked = true;
  }

  /**
   * @dev Add allocation amount to investor addresses
   * Only the owner of this contract - the crowdsale can call this function
   * Split half to be locked by timelock in vault, the other half to be released on vault unlock
   * @param _investor Investor address
   * @param _amount Amount of tokens to add
   */
  function allocateInvestorBonusToken(address _investor, uint256 _amount) public onlyOwner {
    require(!vaultUnlocked);
    require(!vaultSecondaryUnlocked);

    uint256 bonusTokenAmount = _amount.div(2);
    uint256 bonusLockedTokenAmount = _amount.sub(bonusTokenAmount);

    balances[_investor] = balances[_investor].add(bonusTokenAmount);
    lockedBalances[_investor] = lockedBalances[_investor].add(bonusLockedTokenAmount);

    Allocated(_investor, _amount);
  }

  /**
   * @dev Transfers bonus tokens held to investor
   * @param _investor Investor address making the claim
   */
  function claim(address _investor) public onlyOwner {
    // _investor is the original initiator
    // msg.sender is the contract that called this.
    require(vaultUnlocked);

    uint256 claimAmount = balances[_investor];
    require(claimAmount > 0);

    uint256 tokenAmount = token.balanceOf(this);
    require(tokenAmount > 0);

    // Empty token balance
    balances[_investor] = 0;

    token.safeTransfer(_investor, claimAmount);

    Distributed(_investor, claimAmount);
  }

  /**
   * @dev Transfers secondary bonus tokens held to investor
   * @param _investor Investor address making the claim
   */
  function claimLocked(address _investor) public onlyOwner {
    // _investor is the original initiator
    // msg.sender is the contract that called this.
    require(vaultUnlocked);
    require(vaultSecondaryUnlocked);

    uint256 claimAmount = lockedBalances[_investor];
    require(claimAmount > 0);

    uint256 tokenAmount = token.balanceOf(this);
    require(tokenAmount > 0);

    // Empty token balance
    lockedBalances[_investor] = 0;

    token.safeTransfer(_investor, claimAmount);

    Distributed(_investor, claimAmount);
  }
}
