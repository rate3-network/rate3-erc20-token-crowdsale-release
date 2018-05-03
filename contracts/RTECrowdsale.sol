pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "./RTEBonusTokenVault.sol";
import "./RTEToken.sol";

/**
 * @title RTECrowdsale
 * @dev test
 */
contract RTECrowdsale is AllowanceCrowdsale, WhitelistedCrowdsale, FinalizableCrowdsale {
  using SafeERC20 for ERC20;

  uint256 public constant minimumInvestmentInWei = 0.5 ether;

  uint256 public allTokensSold;

  uint256 public bonusTokensSold;

  uint256 public cap;

  mapping (address => uint256) public tokenInvestments;

  mapping (address => uint256) public bonusTokenInvestments;

  RTEBonusTokenVault public bonusTokenVault;

  /**
   * @dev Contract initialization parameters
   * @param _openingTime Public crowdsale opening time
   * @param _closingTime Public crowdsale closing time
   * @param _rate Initial rate (Maybe remove, put as constant)
   * @param _cap RTE token issue cap (Should be the same amount as approved allowance from issueWallet)
   * @param _wallet Multisig wallet to send ether raised to
   * @param _issueWallet Wallet that approves allowance of tokens to be issued
   * @param _token RTE token address deployed seperately
   */
  function RTECrowdsale(
    uint256 _openingTime,
    uint256 _closingTime,
    uint256 _rate,
    uint256 _cap,
    address _wallet,
    address _issueWallet,
    RTEToken _token
  )
    AllowanceCrowdsale(_issueWallet)
    TimedCrowdsale(_openingTime, _closingTime)
    Crowdsale(_rate, _wallet, _token)
    public
  {
    require(_cap > 0);

    cap = _cap;
    bonusTokenVault = new RTEBonusTokenVault(_token);
  }

  /**
   * @dev Checks whether the cap for RTE has been reached.
   * @return Whether the cap was reached
   */
  function capReached() public view returns (bool) {
    return allTokensSold >= cap;
  }

  /**
   * @dev Calculate bonus RTE percentage to be allocated based on time rules
   * time is calculated by now = block.timestamp, will be consistent across transaction if called
   * multiple times in same transaction
   * @return Bonus percentage in percent value
   */
  function _calculateBonusPercentage() internal view returns (uint256) {
    return 20;
  }

  /**
   * @dev Get current RTE balance of bonus token vault
   */
  function getRTEBonusTokenVaultBalance() public view returns (uint256) {
    return token.balanceOf(address(bonusTokenVault));
  }

  /**
   * @dev Extend parent behavior requiring purchase to respect minimum investment per transaction.
   * @param _beneficiary Token purchaser
   * @param _weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(msg.value >= minimumInvestmentInWei);
  }

  /**
   * @dev Keep track of tokens purchased extension functionality
   * @param _beneficiary Address performing the token purchase
   * @param _tokenAmount Value in amount of token purchased
   */
  function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    uint256 bonusPercentage = _calculateBonusPercentage();
    uint256 additionalBonusTokens = _tokenAmount.mul(bonusPercentage).div(100);
    uint256 tokensSold = _tokenAmount;

    // Check if exceed token sale cap
    uint256 newAllTokensSold = allTokensSold.add(tokensSold).add(additionalBonusTokens);
    require(newAllTokensSold <= cap);

    // Process purchase
    super._processPurchase(_beneficiary, tokensSold);
    allTokensSold = allTokensSold.add(tokensSold);
    tokenInvestments[_beneficiary] = tokenInvestments[_beneficiary].add(tokensSold);

    if (additionalBonusTokens > 0) {
      // Record bonus tokens allocated and transfer it to RTEBonusTokenVault
      allTokensSold = allTokensSold.add(additionalBonusTokens);
      bonusTokensSold = bonusTokensSold.add(additionalBonusTokens);
      bonusTokenVault.allocateInvestorBonusToken(_beneficiary, additionalBonusTokens);
      bonusTokenInvestments[_beneficiary] = bonusTokenInvestments[_beneficiary].add(additionalBonusTokens);
    }
  }

  /**
   * @dev Unlock secondary tokens, can only be done by owner of contract
   */
  function unlockSecondaryTokens() public onlyOwner {
    require(isFinalized);
    bonusTokenVault.unlockSecondary();
  }

  /**
   * @dev Claim bonus tokens from vault after bonus tokens are released
   * @param _beneficiary Address receiving the tokens
   */
  function claimBonusTokens(address _beneficiary) public {
    require(isFinalized);
    bonusTokenVault.claim(_beneficiary);
  }

  /**
   * @dev Claim timelocked bonus tokens from vault after bonus tokens are released
   * @param _beneficiary Address receiving the tokens
   */
  function claimLockedBonusTokens(address _beneficiary) public {
    require(isFinalized);
    bonusTokenVault.claimLocked(_beneficiary);
  }

  /**
   * @dev Called manually when token sale has ended with finalize()
   */
  function finalization() internal {
    // Credit bonus tokens sold to bonusTokenVault
    token.transferFrom(tokenWallet, bonusTokenVault, bonusTokensSold);

    // Unlock bonusTokenVault for non-timelocked tokens to be claimed
    bonusTokenVault.unlock();

    super.finalization();
  }
}
