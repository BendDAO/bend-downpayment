[![Build pass](https://github.com/BendDAO/bend-downpayment/actions/workflows/tests.yaml/badge.svg)](https://github.com/BendDAO/bend-downpayment/actions/workflows/tests.js.yml)
[![codecov](https://codecov.io/gh/BendDAO/bend-downpayment/branch/main/graph/badge.svg?token=SduBujdAUN)](https://codecov.io/gh/BendDAO/bend-downpayment)

```
######                       ######     #    #######
#     # ###### #    # #####  #     #   # #   #     #
#     # #      ##   # #    # #     #  #   #  #     #
######  #####  # #  # #    # #     # #     # #     #
#     # #      #  # # #    # #     # ####### #     #
#     # #      #   ## #    # #     # #     # #     #
######  ###### #    # #####  ######  #     # #######
```

# BendDAO Downpayment

## Description

This project contains all smart contracts used for the current BendDAO downpayment features. This includes:

- abstract downpayment contract
- BendDAO downpayment contract
- OpenSea downpayment contract
- LooksRare downpayment contract
- X2Y2 downpayment contract

## Documentation

The documentation for the downpayment smart contracts is available [here](https://docs.benddao.xyz/developers/deployed-contracts/down-payment).

## Installation

```shell
# Yarn
yarn add @benddao/bend-downpayment

# NPM
npm install @benddao/bend-downpayment
```

## NPM package

The NPM package contains the following:

- Solidity smart contracts (_".sol"_)
- ABI files (_".json"_)

## About this repo

### Structure

It is a hybrid [Hardhat](https://hardhat.org/) repo that also requires [Foundry](https://book.getfoundry.sh/index.html) to run Solidity tests powered by the [ds-test library](https://github.com/dapphub/ds-test/).

> To install Foundry, please follow the instructions [here](https://book.getfoundry.sh/getting-started/installation.html).

### Run tests

- TypeScript tests are included in the `test` folder at the root of this repo.
- Solidity tests are included in the `test` folder in the `contracts` folder.

### Example of Foundry/Forge commands

```shell
forge build
forge test
forge test -vv
forge tree
```

### Example of Hardhat commands

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

## Release

- Create a [Personal access token](https://github.com/settings/tokens/new?scopes=repo&description=release-it) (Don't change the default scope)
- Create an `.env` (copy `.env.template`) and set your GitHub personal access token.
- `yarn release` will run all the checks, build, and publish the package, and publish the GitHub release note.
