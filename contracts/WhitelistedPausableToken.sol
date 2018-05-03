pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";

/**
 * @title Whitelisted Pausable token
 * @dev StandardToken modified with pausable transfers. Enables a whitelist to enable transfers
 * only for certain addresses such as crowdsale contract, issuing account etc.
 **/
contract WhitelistedPausableToken is StandardToken, Pausable {

  mapping(address => bool) public whitelist;

  /**
   * @dev Reverts if the message sender requesting for transfer is not whitelisted when token
   * transfers are paused
   * @param _sender check transaction sender address
   */
  modifier whenNotPausedOrWhitelisted(address _sender) {
    require(whitelist[_sender] || !paused);
    _;
  }

  /**
   * @dev Adds single address to whitelist.
   * @param _whitelistAddress Address to be added to the whitelist
   */
  function addToWhitelist(address _whitelistAddress) external onlyOwner {
    whitelist[_whitelistAddress] = true;
  }

  /**
   * @dev Adds list of addresses to whitelist. Not overloaded due to limitations with truffle testing.
   * @param _whitelistAddresses Addresses to be added to the whitelist
   */
  function addManyToWhitelist(address[] _whitelistAddresses) external onlyOwner {
    for (uint256 i = 0; i < _whitelistAddresses.length; i++) {
      whitelist[_whitelistAddresses[i]] = true;
    }
  }

  /**
   * @dev Removes single address from whitelist.
   * @param _whitelistAddress Address to be removed to the whitelist
   */
  function removeFromWhitelist(address _whitelistAddress) external onlyOwner {
    whitelist[_whitelistAddress] = false;
  }

  // Adding modifier to transfer/approval functions
  function transfer(address _to, uint256 _value) public whenNotPausedOrWhitelisted(msg.sender) returns (bool) {
    return super.transfer(_to, _value);
  }

  function transferFrom(address _from, address _to, uint256 _value) public whenNotPausedOrWhitelisted(msg.sender) returns (bool) {
    return super.transferFrom(_from, _to, _value);
  }

  function approve(address _spender, uint256 _value) public whenNotPausedOrWhitelisted(msg.sender) returns (bool) {
    return super.approve(_spender, _value);
  }

  function increaseApproval(address _spender, uint _addedValue) public whenNotPausedOrWhitelisted(msg.sender) returns (bool success) {
    return super.increaseApproval(_spender, _addedValue);
  }

  function decreaseApproval(address _spender, uint _subtractedValue) public whenNotPausedOrWhitelisted(msg.sender) returns (bool success) {
    return super.decreaseApproval(_spender, _subtractedValue);
  }
}
