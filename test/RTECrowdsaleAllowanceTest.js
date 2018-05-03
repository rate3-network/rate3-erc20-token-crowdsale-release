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
contract('RTECrowdsale Allowance Test', function (accounts) {
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

  // Helper parameters
  const minimumInvestmentInWei = new web3.BigNumber(web3.toWei(0.5, 'ether'));

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  describe('accepting payments based on individual minimum per transaction', function () {
    beforeEach(async function () {
      // Setup dummy times
      this.openingTime = latestTime() + duration.weeks(1);
      this.closingTime = this.openingTime + duration.weeks(5);

      this.token = await RTEToken.new();
      this.crowdsale = await RTECrowdsale.new(this.openingTime, this.closingTime, rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
      // Transfer crowdsaleSupply to issueWallet, do not approve allowance yet
      await this.token.transfer(issueWallet, crowdsaleSupply);

      // Add testWallet1 to whitelist
      await this.crowdsale.addToWhitelist(testWallet1);
      await this.crowdsale.addToWhitelist(testWallet2);

      // Pause ICO Transfers
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);

      // Set time to opening time, since we are not testing for this here
      await increaseTimeTo(this.openingTime);
    });

    it('should reject if no allowance', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: minimumInvestmentInWei }).should.be.rejectedWith('revert');
    });

    // We cannot send below minimum of 1 ether, hence the default test allowance will be 2 ether
    it('should accept if equal allowance', async function () {
      await this.token.approve(this.crowdsale.address, minimumInvestmentInWei.mul(rate).mul(2), { from: issueWallet });
      await this.crowdsale.sendTransaction({ from: testWallet1, value: minimumInvestmentInWei.mul(2) }).should.be.fulfilled;
    });

    it('should accept if lower than allowance', async function () {
      await this.token.approve(this.crowdsale.address, minimumInvestmentInWei.mul(rate).mul(2), { from: issueWallet });
      await this.crowdsale.sendTransaction({ from: testWallet1, value: minimumInvestmentInWei.mul(2).minus(1) }).should.be.fulfilled;
    });

    it('should reject if exceed allowance', async function () {
      await this.token.approve(this.crowdsale.address, minimumInvestmentInWei.mul(rate).mul(2), { from: issueWallet });
      await this.crowdsale.sendTransaction({ from: testWallet1, value: minimumInvestmentInWei.mul(2) });
      await this.crowdsale.sendTransaction({ from: testWallet1, value: 1 }).should.be.rejectedWith('revert');
      await this.crowdsale.sendTransaction({ from: testWallet2, value: minimumInvestmentInWei }).should.be.rejectedWith('revert');
    });

  });
});
