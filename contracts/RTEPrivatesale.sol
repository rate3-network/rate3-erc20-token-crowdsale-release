pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol";
import "zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "./RTEBonusTokenVault.sol";
import "./RTEToken.sol";

/**
 * @title RTEPrivatesale
 * @dev Private sale contract
 */
contract RTEPrivatesale is AllowanceCrowdsale, Ownable {
  using SafeERC20 for ERC20;

  uint256 public constant minimumInvestmentInWei = 0.5 ether;

  uint256 public allTokensSold;

  uint256 public bonusTokensSold;

  uint256 public cap;

  mapping (address => uint256) public tokenInvestments;

  mapping (address => uint256) public bonusTokenInvestments;

  mapping (address => uint256) public etherContributed;

  RTEBonusTokenVault public bonusTokenVault;

  bool public saleClosed = false;

  mapping(address => uint256) public whitelist;

  /**
   * @dev Contract initialization parameters
   * @param _rate Initial rate (Maybe remove, put as constant)
   * @param _cap RTE token issue cap (Should be the same amount as approved allowance from issueWallet)
   * @param _wallet Multisig wallet to send ether raised to
   * @param _issueWallet Wallet that approves allowance of tokens to be issued
   * @param _token RTE token address deployed seperately
   */
  function RTEPrivatesale(
    uint256 _rate,
    uint256 _cap,
    address _wallet,
    address _issueWallet,
    RTEToken _token
  )
    AllowanceCrowdsale(_issueWallet)
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
   * @dev Calculate bonus RTE percentage to be allocated for private sale
   * @return Bonus percentage in percent value
   */
  function _calculateBonusPercentage() internal view returns (uint256) {
    return 40;
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
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal isWhitelisted(_beneficiary) {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(msg.value >= minimumInvestmentInWei);

    uint256 totalWei = etherContributed[_beneficiary].add(_weiAmount);
    require(totalWei <= whitelist[_beneficiary]);
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
    require(saleClosed);
    bonusTokenVault.unlockSecondary();
  }

  /**
   * @dev Claim bonus tokens from vault after bonus tokens are released
   * @param _beneficiary Address receiving the tokens
   */
  function claimBonusTokens(address _beneficiary) public {
    require(saleClosed);
    bonusTokenVault.claim(_beneficiary);
  }

  /**
   * @dev Claim timelocked bonus tokens from vault after bonus tokens are released
   * @param _beneficiary Address receiving the tokens
   */
  function claimLockedBonusTokens(address _beneficiary) public {
    require(saleClosed);
    bonusTokenVault.claimLocked(_beneficiary);
  }

  /**
   * @dev Close private sale and do necessary cleanup
   */
  function closeSale() public onlyOwner {
    require(!saleClosed);
    saleClosed = true;

    // Credit bonus tokens sold to bonusTokenVault
    token.transferFrom(tokenWallet, bonusTokenVault, bonusTokensSold);

    // Unlock bonusTokenVault for non-timelocked tokens to be claimed
    bonusTokenVault.unlock();
  }

  /**
   * @dev Reverts if beneficiary is not whitelisted. Can be used when extending this contract.
   */
  modifier isWhitelisted(address _beneficiary) {
    require(whitelist[_beneficiary] != 0);
    _;
  }

  /**
   * @dev Adds single address to whitelist.
   * @param _beneficiary Address to be added to the whitelist
   * @param _amount Maximum ether contribution amount
   */
  function addToWhitelist(address _beneficiary, uint256 _amount) external onlyOwner {
    whitelist[_beneficiary] = _amount;
  }

  /**
   * @dev Removes single address from whitelist.
   * @param _beneficiary Address to be removed to the whitelist
   */
  function removeFromWhitelist(address _beneficiary) external onlyOwner {
    whitelist[_beneficiary] = 0;
  }

  /**
   * @dev Override for extensions that require an internal state to check for validity (current user contributions, etc.)
   * @param _beneficiary Address receiving the tokens
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
    // Update ether contributed
    etherContributed[_beneficiary] = etherContributed[_beneficiary].add(_weiAmount);
  }
}
