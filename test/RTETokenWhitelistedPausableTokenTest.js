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
contract('RTEToken WhitelistedPausableToken Test', function (accounts) {
  // Contract init parameters
  const rate = new web3.BigNumber(8000);
  const crowdsaleSupply = new web3.BigNumber('400000000e+18');

  // Testnet account labelling
  const adminWallet = accounts[0];
  const foundationWallet = accounts[1];
  const issueWallet = accounts[2];
  const etherCollectionWallet = accounts[3];
  const testWallet1 = accounts[8];
  const testWallet2 = accounts[9];

  // Additonal helpers
  let value = new web3.BigNumber(web3.toWei(1, 'ether')); // Value should still be lower than cap

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.token = await RTEToken.new();

    // Transfer crowdsaleSupply to issueWallet
    await this.token.transfer(issueWallet, crowdsaleSupply);
  });

  describe('check pause', function () {
    it('owner is able to pause', async function () {
      await this.token.pause().should.be.fulfilled;
    });

    it('others cannot pause', async function () {
      await this.token.pause({ from: testWallet1 }).should.be.rejected;
    });
  });

  describe('check approval', function () {
    it('should accept approval from any address when not paused', async function () {
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.fulfilled;
    });

    it('should reject approval from non whitelisted addresses when paused', async function () {
      await this.token.pause();
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.rejected;
    });

    it('should accept approval from whitelisted addresses when paused', async function () {
      await this.token.pause();
      await this.token.addToWhitelist(issueWallet);
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.fulfilled;
    });

    it('should reject approval from addresses removed from whitelist when paused', async function () {
      await this.token.pause();
      await this.token.addToWhitelist(issueWallet);
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet });
      await this.token.removeFromWhitelist(issueWallet);
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.rejected;
    });
  });

  describe('check transfers', function () {
    it('should accept transfers from any address when not paused', async function () {
      await this.token.transfer(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.fulfilled;
    });

    it('should reject transfers from non whitelisted addresses when paused', async function () {
      await this.token.pause();
      await this.token.transfer(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.rejected;
    });

    it('should accept transfers from whitelisted addresses when paused', async function () {
      await this.token.pause();
      await this.token.addToWhitelist(issueWallet);
      await this.token.transfer(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.fulfilled;
    });

    it('should reject transfers from addresses removed from whitelist when paused', async function () {
      await this.token.pause();
      await this.token.addToWhitelist(issueWallet);
      await this.token.transfer(testWallet1, crowdsaleSupply, { from: issueWallet });
      await this.token.removeFromWhitelist(issueWallet);
      await this.token.transfer(testWallet1, crowdsaleSupply, { from: issueWallet }).should.be.rejected;
    });
  });

  describe('check transferFrom', function () {
    it('should reject transferFrom from non whitelisted addresses when paused', async function () {
      await this.token.pause();
      await this.token.addToWhitelist(issueWallet);
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet });
      await this.token.transferFrom(issueWallet, testWallet2, crowdsaleSupply, { from: testWallet1 }).should.be.rejected;
    });

    it('should accept transferFrom from whitelisted addresses when paused', async function () {
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, testWallet1]);
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet });
      await this.token.transferFrom(issueWallet, testWallet2, crowdsaleSupply, { from: testWallet1 }).should.be.fulfilled;
    });

    it('should reject transferFrom from addresses removed from whitelist', async function () {
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, testWallet1]);
      await this.token.approve(testWallet1, crowdsaleSupply, { from: issueWallet });
      await this.token.removeFromWhitelist(testWallet1);
      await this.token.transferFrom(issueWallet, testWallet2, crowdsaleSupply, { from: testWallet1 }).should.be.rejected;
    });
  });
});
