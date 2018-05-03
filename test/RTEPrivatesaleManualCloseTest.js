import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';
import { advanceBlock } from './helpers/advanceToBlock';

const RTEPrivatesale = artifacts.require("./RTEPrivatesale.sol");
const RTEToken = artifacts.require("./RTEToken.sol");

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

// Assumes the command: ganache-cli -e 100000
// 100000 default ether, 10 accounts created
contract('RTEPrivatesale Manual Close Test', function (accounts) {
  // Contract init parameters
  const rate = new web3.BigNumber(8000);
  const crowdsaleSupply = new web3.BigNumber('400000000e+18');

  // Testnet account labelling
  const adminWallet = accounts[0];
  const foundationWallet = accounts[1];
  const issueWallet = accounts[2];
  const etherCollectionWallet = accounts[3];
  const authorizedWallet1 = accounts[7];
  const authorizedWallet2 = accounts[8];
  const unauthorizedWallet = accounts[9];

  // Additonal helpers
  let value = new web3.BigNumber(web3.toWei(1, 'ether')); // Value should still be lower than cap

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  describe('manually closing sale', function () {
    beforeEach(async function () {
      this.token = await RTEToken.new();
      this.crowdsale = await RTEPrivatesale.new(rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
      // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
      await this.token.transfer(issueWallet, crowdsaleSupply);
      await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

      // Add authorizedWallet1 to whitelist (single user)
      await this.crowdsale.addToWhitelist(authorizedWallet1, value);

      // Pause ICO Transfers
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);
    });

    describe('accepting payments', function () {
      it('should accept payments before close', async function () {
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: authorizedWallet1 }).should.be.fulfilled;
      });

      it('should reject payments after close', async function () {
        await this.crowdsale.closeSale({ from: adminWallet });
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: authorizedWallet1 }).should.be.rejected;
      });
    });
  });
});
