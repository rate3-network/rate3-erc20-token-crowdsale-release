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
contract('RTECrowdsale Bonus Tokens Test', function (accounts) {
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

  const phase1Bonus = new web3.BigNumber(1.20);
  const phase1TotalBonus = new web3.BigNumber(1.40);
  const phase1expectedTokenAmount = rate.mul(investmentInWeiForBonus.mul(phase1Bonus));
  const phase1expectedTotalTokenAmount = rate.mul(investmentInWeiForBonus.mul(phase1TotalBonus));

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  describe('claiming bonus tokens', function () {
    beforeEach(async function () {
      this.token = await RTEToken.new();
      this.crowdsale = await RTEPrivatesale.new(rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
      // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
      await this.token.transfer(issueWallet, crowdsaleSupply);
      await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

      // Add testWallet1 to whitelist
      await this.crowdsale.addToWhitelist(testWallet1, investmentInWeiForBonus);

      // Pause ICO Transfers
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);
    });

    it('claiming bonus tokens should fail before finalization', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 }).should.be.rejectedWith('revert');
    });

    it('claiming bonus tokens should succeed after finalization', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.closeSale({ from: adminWallet });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 }).should.be.fulfilled;
    });

    it('claiming locked bonus tokens should fail before secondaryUnlock', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.closeSale({ from: adminWallet });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet1 }).should.be.rejectedWith('revert');
    });

    it('claiming locked bonus tokens should succeed after secondaryUnlock', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.closeSale({ from: adminWallet });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.unlockSecondaryTokens();

      await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet1 }).should.be.fulfilled;
    });
  });

  describe('check bonus token received amount', function () {
    beforeEach(async function () {
      this.token = await RTEToken.new();
      this.crowdsale = await RTEPrivatesale.new(rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
      // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
      await this.token.transfer(issueWallet, crowdsaleSupply);
      await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

      // Add testWallet1 to whitelist
      await this.crowdsale.addToWhitelist(testWallet1, investmentInWeiForBonus.mul(3));

      // Pause ICO Transfers
      await this.token.pause();
      await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);
    });

    it('for 20% initial bonus in phase 1', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.closeSale({ from: adminWallet });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 });
      let balance = await this.token.balanceOf(testWallet1);
      balance.should.be.bignumber.equal(phase1expectedTokenAmount);
    });

    it('for 40% total bonus including timelocked tokens in phase 1', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.closeSale({ from: adminWallet });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.unlockSecondaryTokens();

      await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 });
      await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet1 });
      let balance = await this.token.balanceOf(testWallet1);
      balance.should.be.bignumber.equal(phase1expectedTotalTokenAmount);
    });


    it('for total bonus including timelocked tokens after cummulative contributions', async function () {
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
      await this.crowdsale.closeSale({ from: adminWallet });

      // Unpause token freeze, since bonus token vault is not whitelisted
      await this.token.unpause();

      await this.crowdsale.unlockSecondaryTokens();

      await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 });
      let balance1 = await this.token.balanceOf(testWallet1);
      balance1.should.be.bignumber.equal(phase1expectedTokenAmount.mul(3));

      await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet1 });
      let balance2 = await this.token.balanceOf(testWallet1);
      balance2.should.be.bignumber.equal(phase1expectedTotalTokenAmount.mul(3));
    });
  });

    describe('check bonus token vault', function () {
      beforeEach(async function () {
        this.token = await RTEToken.new();
        this.crowdsale = await RTEPrivatesale.new(rate, crowdsaleSupply, etherCollectionWallet, issueWallet, this.token.address);
        // Transfer crowdsaleSupply to issueWallet, then approve the same amount between crowdsale contract and presale wallet
        await this.token.transfer(issueWallet, crowdsaleSupply);
        await this.token.approve(this.crowdsale.address, crowdsaleSupply, { from: issueWallet });

        // Add testWallet1 to whitelist
        await this.crowdsale.addToWhitelist(testWallet1, investmentInWeiForBonus.mul(3));

        // Pause ICO Transfers
        await this.token.pause();
        await this.token.addManyToWhitelist([issueWallet, foundationWallet, adminWallet, this.crowdsale.address]);
      });

      it('only owner of crowdsale can unlock secondary tokens', async function () {
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.closeSale({ from: adminWallet });

        // Unpause token freeze, since bonus token vault is not whitelisted
        await this.token.unpause();

        await this.crowdsale.unlockSecondaryTokens({ from: testWallet1 }).should.be.rejected;
        await this.crowdsale.unlockSecondaryTokens({ from: adminWallet }).should.be.fulfilled;
      });

      it('someone else can help to claim tokens for any address', async function () {
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.closeSale({ from: adminWallet });

        // Unpause token freeze, since bonus token vault is not whitelisted
        await this.token.unpause();

        await this.crowdsale.unlockSecondaryTokens();

        await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet2 }).should.be.fulfilled;
        await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet2 }).should.be.fulfilled;
        let balance = await this.token.balanceOf(testWallet1);
        balance.should.be.bignumber.equal(phase1expectedTotalTokenAmount.mul(3));
      });

      it('only able to claim once per address', async function () {
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.sendTransaction({ from: testWallet1, value: investmentInWeiForBonus });
        await this.crowdsale.closeSale({ from: adminWallet });

        // Unpause token freeze, since bonus token vault is not whitelisted
        await this.token.unpause();

        await this.crowdsale.unlockSecondaryTokens();

        await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 });
        await this.crowdsale.claimBonusTokens(testWallet1, { from: testWallet1 }).should.be.rejected;
        await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet1 });
        await this.crowdsale.claimLockedBonusTokens(testWallet1, { from: testWallet1 }).should.be.rejected;
        let balance = await this.token.balanceOf(testWallet1);
        balance.should.be.bignumber.equal(phase1expectedTotalTokenAmount.mul(3));
      });
    });
});
