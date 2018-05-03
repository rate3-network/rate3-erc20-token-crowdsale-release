# Rate3 (RTE) ERC-20 Token and Crowdsale

## Requirements
- truffle
- ganache-cli@6.1.0-beta.0
- Uses openzeppelin latest 1.7.0 templates

## Testing instructions
```
npm install
truffle compile
ganache-cli -e 100000
truffle test
```

## Token Details
- Hard supply limit of 1,000,000,000 tokens.
- Tokens are approve/transfers locked when pause() is called by token contract owner, whitelisted addresses are available to circumvent this lock (for the token sale to be conducted, but token holders cannot trade until unpause())
- Tokens are minted on contract deployment and all tokens transferred to the contract owner.

## Details on Crowdsale
- Only whitelisted addresses can participate
- There is a minimum contribution of 0.5 ether per incoming transaction
- Normal rate is 1 ETH = 16000 RTE
- Tokens are distributed through an allowance with approval from an issuing wallet
- Bonus tokens rate is now determined by token sale phases
- Bonus tokens are 50% locked until token sale ends, and the other 50% are locked until a later date specified
- RTE is distributed immediately on successful transaction
- BonusTokenVault will only be funded and claimable after token sale ends, accessible through claim functions on the crowdsale contract itself

## Bonus Token Structure
- 20% token bonus (10% locked until right after crowdsale, 10% locked until a further date)
