pragma solidity 0.4.19;

import "./WhitelistedPausableToken.sol";

/**
 * @title RTEToken
 * @dev ERC20 token implementation
 * Pausable
 */
contract RTEToken is WhitelistedPausableToken {
  string public constant name = "Rate3";
  string public constant symbol = "RTE";
  uint8 public constant decimals = 18;

  // 1 billion initial supply of RTE tokens
  // Taking into account 18 decimals
  uint256 public constant INITIAL_SUPPLY = (10 ** 9) * (10 ** 18);

  /**
   * @dev RTEToken Constructor
   * Mints the initial supply of tokens, this is the hard cap, no more tokens will be minted.
   * Allocate the tokens to the foundation wallet, issuing wallet etc.
   */
  function RTEToken() public {
    // Mint initial supply of tokens. All further minting of tokens is disabled
    totalSupply_ = INITIAL_SUPPLY;

    // Transfer all initial tokens to msg.sender
    balances[msg.sender] = INITIAL_SUPPLY;
    Transfer(0x0, msg.sender, INITIAL_SUPPLY);
  }
}
