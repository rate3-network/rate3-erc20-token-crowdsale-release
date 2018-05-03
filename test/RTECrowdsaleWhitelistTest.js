import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';
import { advanceBlock } from './helpers/advanceToBlock';

const RTECrowdsale = artifacts.require("./RTECrowdsale.sol");
const RTEToken = artifacts.require("./RTEToken.sol");

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

// Assumes the command: ganache-cli -e 100000
// 100000 default ether, 10 accounts created
contract('RTECrowdsale Whitelist Test', function (accounts) {
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

  describe('single user whitelisting', function () {
    beforeEach(async function () {
      // Setup dummy times
      this.openingTime = latestTime() + duration.weeks(1);
      this.closingTime = this.openingTime + duration.weeks(5);

      this.token = await RTEToken.new();
      this.crowdsale = await RTECrowdsale.new(this.openingTime, this.closingTime, rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
      // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
      await this.token.transfer(issueWallet, crowdsaleSupply);
      await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

      // Add authorizedWallet1 to whitelist (single user)
      await this.crowdsale.addToWhitelist(authorizedWallet1);

      // Pause ICO Transfers
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);

      // Set time to opening time, since we are not testing for this here
      await increaseTimeTo(this.openingTime);
    });

    describe('accepting payments', function () {
      it('should accept payments to whitelisted (from whichever buyers)', async function () {
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: authorizedWallet1 }).should.be.fulfilled;
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: unauthorizedWallet }).should.be.fulfilled;
      });

      it('should reject payments to not whitelisted (from whichever buyers)', async function () {
        await this.crowdsale.send(value).should.be.rejected;
        await this.crowdsale.buyTokens(unauthorizedWallet, { value: value, from: unauthorizedWallet }).should.be.rejected;
        await this.crowdsale.buyTokens(unauthorizedWallet, { value: value, from: authorizedWallet1 }).should.be.rejected;
      });

      it('should reject payments to addresses removed from whitelist', async function () {
        await this.crowdsale.removeFromWhitelist(authorizedWallet1);
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: authorizedWallet1 }).should.be.rejected;
      });
    });

    describe('reporting whitelisted', function () {
      it('should correctly report whitelisted addresses', async function () {
        let isAuthorized = await this.crowdsale.whitelist(authorizedWallet1);
        isAuthorized.should.equal(true);
        let isntAuthorized = await this.crowdsale.whitelist(unauthorizedWallet);
        isntAuthorized.should.equal(false);
      });
    });
  });

  describe('many user whitelisting', function () {
    beforeEach(async function () {
      // Setup dummy times
      this.openingTime = latestTime() + duration.weeks(1);
      this.closingTime = this.openingTime + duration.weeks(5);

      this.token = await RTEToken.new();
      this.crowdsale = await RTECrowdsale.new(this.openingTime, this.closingTime, rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
      // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
      await this.token.transfer(issueWallet, crowdsaleSupply);
      await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

      // Add authorizedWallet1 and authorizedWallet2 to whitelist (multiple user)
      await this.crowdsale.addToWhitelist(authorizedWallet1);
      await this.crowdsale.addToWhitelist(authorizedWallet2);

      // Pause ICO Transfers
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);

      // Set time to opening time, since we are not testing for this here
      await increaseTimeTo(this.openingTime);
    });

    describe('accepting payments', function () {
      it('should accept payments to whitelisted (from whichever buyers)', async function () {
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: authorizedWallet1 }).should.be.fulfilled;
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: unauthorizedWallet }).should.be.fulfilled;
        await this.crowdsale.buyTokens(authorizedWallet2, { value: value, from: authorizedWallet1 }).should.be.fulfilled;
        await this.crowdsale.buyTokens(authorizedWallet2, { value: value, from: unauthorizedWallet }).should.be.fulfilled;
      });

      it('should reject payments to not whitelisted (with whichever buyers)', async function () {
        await this.crowdsale.send(value).should.be.rejected;
        await this.crowdsale.buyTokens(unauthorizedWallet, { value: value, from: unauthorizedWallet }).should.be.rejected;
        await this.crowdsale.buyTokens(unauthorizedWallet, { value: value, from: authorizedWallet1 }).should.be.rejected;
      });

      it('should reject payments to addresses removed from whitelist', async function () {
        await this.crowdsale.removeFromWhitelist(authorizedWallet2);
        await this.crowdsale.buyTokens(authorizedWallet1, { value: value, from: authorizedWallet1 }).should.be.fulfilled;
        await this.crowdsale.buyTokens(authorizedWallet2, { value: value, from: authorizedWallet1 }).should.be.rejected;
      });
    });

    describe('reporting whitelisted', function () {
      it('should correctly report whitelisted addresses', async function () {
        let isAuthorized = await this.crowdsale.whitelist(authorizedWallet1);
        isAuthorized.should.equal(true);
        let isAnotherAuthorized = await this.crowdsale.whitelist(authorizedWallet2);
        isAnotherAuthorized.should.equal(true);
        let isntAuthorized = await this.crowdsale.whitelist(unauthorizedWallet);
        isntAuthorized.should.equal(false);
      });
    });
  });
});
