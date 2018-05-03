const RTECrowdsale = artifacts.require("./RTECrowdsale.sol");
const RTEToken = artifacts.require("./RTEToken.sol");

// These are temporary values
module.exports = function(deployer, network, accounts) {
  // Use hardcoded values for deployment to testnet
  const openingTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 10; // 10 seconds in future
  const closingTime = openingTime + (86400 * 20) // 20 days
  const rate = new web3.BigNumber('16000');
  const cap = new web3.BigNumber('400000000e+18');
  const wallet = accounts[0]; // First address will be main contract wallet (admin owner)
  const issueWallet = accounts[2]; // Issuing wallet giving allowance of RTE tokens
  const etherCollectionWallet = accounts[3]; // Ether collection wallet

  // Deploy token contract, then deploy crowdsale contract with token deployed address
  deployer.deploy(RTEToken).then(function() {
    return deployer.deploy(RTECrowdsale, openingTime, closingTime, rate, cap, etherCollectionWallet, issueWallet, RTEToken.address);
  });
};
