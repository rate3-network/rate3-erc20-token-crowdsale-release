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
contract('RTECrowdsale Finalization Test', function (accounts) {
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
  const investmentInWeiForBonus = new web3.BigNumber(web3.toWei(10, 'ether'));
  const phase1bonus = new web3.BigNumber(0.20);
  const phase1expectedTokenAmount = rate.mul(investmentInWeiForBonus.mul(phase1bonus));
  const phase3bonus = new web3.BigNumber(0.10);
  const phase3expectedTokenAmount = rate.mul(investmentInWeiForBonus.mul(phase3bonus));

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    // Setup dummy times
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(5);

    this.token = await RTEToken.new();
    this.crowdsale = await RTECrowdsale.new(this.openingTime, this.closingTime, rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
    // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
    await this.token.transfer(issueWallet, crowdsaleSupply);
    await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

    // Add testWallet1 and testwallet2 to whitelist
    await this.crowdsale.addToWhitelist(testWallet1);
    await this.crowdsale.addToWhitelist(testWallet2);

    // Pause ICO Transfers
    await this.token.pause();
    await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);

    // Set time to opening time, since we are not testing for this here
    await increaseTimeTo(this.openingTime);

    // Send transactions for phase 1 and phase 3
    await this.crowdsale.sendTransaction({ from: testWallet2, value: investmentInWeiForBonus });
    await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });

    await increaseTimeTo(this.openingTime + duration.weeks(2) + duration.seconds(10));

    await this.crowdsale.sendTransaction({ from: testWallet2, value: investmentInWeiForBonus });
    await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
  });

  describe('calling finalization', function () {
    it('fails when closing time is not hit', async function () {
      await this.crowdsale.finalize({ from: adminWallet }).should.be.rejectedWith('revert');
    });

    it('succeed after closing time is hit', async function () {
      increaseTimeTo(this.closingTime + duration.seconds(10));
      await this.crowdsale.finalize({ from: adminWallet })
    });
  });

  describe('token during finalization', function () {
    it('transfer bonus tokens to vault', async function () {
      // Set time to closing time so that we enable finalize
      increaseTimeTo(this.closingTime + duration.seconds(10));
      await this.crowdsale.finalize({ from: adminWallet });
      let finalVaultBalance = await this.crowdsale.getRTEBonusTokenVaultBalance();
      // Check vault balance is what we expected
      finalVaultBalance.should.be.bignumber.equal(phase1expectedTokenAmount.mul(2).add(phase3expectedTokenAmount.mul(2)));
    });
  });
});
