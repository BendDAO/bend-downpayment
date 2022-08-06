/* eslint-disable  no-unused-expressions */
import { expect, assert } from "chai";
import { BigNumber, constants } from "ethers";
import { Contracts, Env, makeSuite } from "./_setup";

makeSuite("downpayment", (contracts: Contracts, env: Env) => {
  it("Revertions work as expected", async () => {
    await expect(contracts.downpayment.connect(env.admin).addAdapter(contracts.punkAdapter.address)).to.be.revertedWith(
      "Adapter: already whitelisted"
    );
    await expect(contracts.downpayment.connect(env.admin).addAdapter(constants.AddressZero)).to.be.revertedWith(
      "Adapter: can not be null address"
    );

    await expect(contracts.downpayment.connect(env.admin).removeAdapter(contracts.weth.address)).to.be.revertedWith(
      "Adapter: not whitelisted"
    );

    await expect(contracts.downpayment.connect(env.admin).updateFee(contracts.weth.address, 100)).to.be.revertedWith(
      "Adapter: not whitelisted"
    );

    await expect(contracts.downpayment.connect(env.admin).setFeeCollector(constants.AddressZero)).to.be.revertedWith(
      "Downpayment: feeCollector can not be null address"
    );

    await expect(
      contracts.downpayment.connect(env.admin).updateFee(contracts.punkAdapter.address, 10001)
    ).to.be.revertedWith("Fee overflow");

    await expect(
      contracts.downpayment
        .connect(env.admin)
        .initialize(constants.AddressZero, constants.AddressZero, constants.AddressZero, constants.AddressZero)
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Owner revertions work as expected", async () => {
    await expect(contracts.downpayment.connect(env.accounts[2]).addAdapter(constants.AddressZero)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(
      contracts.downpayment.connect(env.accounts[2]).removeAdapter(constants.AddressZero)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contracts.downpayment.connect(env.accounts[2]).updateFee(constants.AddressZero, 100)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      contracts.downpayment.connect(env.accounts[2]).setFeeCollector(constants.AddressZero)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("functions work as expected", async () => {
    await contracts.downpayment.connect(env.admin).setFeeCollector(env.accounts[3].address);

    expect(await contracts.downpayment.getFeeCollector()).to.be.equal(env.accounts[3].address);

    expect(await contracts.downpayment.isAdapterWhitelisted(contracts.weth.address)).to.be.false;
    await contracts.downpayment.connect(env.admin).addAdapter(contracts.weth.address);
    expect(await contracts.downpayment.isAdapterWhitelisted(contracts.weth.address)).to.be.true;

    let numberAdapters = await contracts.downpayment.viewCountWhitelistedAdapters();
    assert.equal(numberAdapters.toString(), "7");

    let tx = await contracts.downpayment.viewWhitelistedAdapters("0", "1");
    assert.equal(tx[0].length, 1);
    expect(BigNumber.from(tx[1].toString())).to.be.eq(constants.One);

    tx = await contracts.downpayment.viewWhitelistedAdapters("1", "100");
    assert.equal(tx[0].length, 6);
    expect(BigNumber.from(tx[1].toString())).to.be.eq(BigNumber.from(numberAdapters.toString()));

    await contracts.downpayment.connect(env.admin).removeAdapter(contracts.weth.address);
    expect(await contracts.downpayment.isAdapterWhitelisted(contracts.weth.address)).to.be.false;

    numberAdapters = await contracts.downpayment.viewCountWhitelistedAdapters();
    assert.equal(numberAdapters.toString(), "6");

    tx = await contracts.downpayment.viewWhitelistedAdapters("0", "1");
    assert.equal(tx[0].length, 1);
    expect(BigNumber.from(tx[1].toString())).to.be.eq(constants.One);

    tx = await contracts.downpayment.viewWhitelistedAdapters("1", "100");
    assert.equal(tx[0].length, 5);
    expect(BigNumber.from(tx[1].toString())).to.be.eq(BigNumber.from(numberAdapters.toString()));
  });
});
