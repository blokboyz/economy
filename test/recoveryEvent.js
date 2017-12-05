const Nutz = artifacts.require('./satelites/Nutz.sol');
const Power = artifacts.require('./satelites/Power.sol');
const Storage = artifacts.require('./satelites/Storage.sol');
const PullPayment = artifacts.require('./satelites/PullPayment.sol');
const MockController = artifacts.require('./helpers/MockController.sol');
const MockRecoveryHelper = artifacts.require('./helpers/MockRecoveryHelper.sol');
const RecoveryEvent = artifacts.require('./policies/RecoveryEvent.sol');
const BigNumber = require('bignumber.js');
const NTZ_DECIMALS = new BigNumber(10).pow(12);
const POW_DECIMALS = new BigNumber(10).pow(12);
const babz = (ntz) => new BigNumber(NTZ_DECIMALS).mul(ntz);
const ONE_ETH = web3.toWei(1, 'ether');
const WEI_AMOUNT = web3.toWei(0.001, 'ether');
const INFINITY = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

contract('RecoveryEvent', (accounts) => {
  let controller;
  let nutz;
  let storage;
  let pull;
  let power;

  beforeEach(async () => {
    nutz = await Nutz.new();
    power = await Power.new();
    storage = await Storage.new();
    pull = await PullPayment.new();
    controller = await MockController.new(power.address, pull.address, nutz.address, storage.address);
    nutz.transferOwnership(controller.address);
    power.transferOwnership(controller.address);
    storage.transferOwnership(controller.address);
    pull.transferOwnership(controller.address);
    await controller.unpause();
  });

  it('should allow to recover from emergency with corrupted balances', async () => {
    // create token contract
    const SCAMMER = accounts[1];
    const VICTIMS = [accounts[2], accounts[3], accounts[4]];
    const ceiling = new BigNumber(30000);
    await controller.moveFloor(INFINITY);
    await controller.moveCeiling(ceiling);
    // purchase some tokens with ether
    await nutz.purchase(ceiling, {from: VICTIMS[0], value: ONE_ETH });
    await nutz.purchase(ceiling, {from: VICTIMS[1], value: ONE_ETH });
    await nutz.purchase(ceiling, {from: VICTIMS[2], value: ONE_ETH });
    const babzBal = await nutz.balanceOf.call(VICTIMS[0]);

    // some bug lets scammer steam nutz from economy
    await controller.stealNutz(VICTIMS[0], babzBal, {from: SCAMMER });
    await controller.stealNutz(VICTIMS[1], babzBal, {from: SCAMMER });
    await controller.stealNutz(VICTIMS[2], babzBal, {from: SCAMMER });

    const balanceScammer = await nutz.balanceOf.call(SCAMMER);
    assert.equal(balanceScammer.toNumber(), babzBal.mul(3).toNumber());

    // escrow council notices the theft and pauses controller immediately
    await controller.pause();
    let nutzHolders = VICTIMS;
    nutzHolders.push(SCAMMER);
    const rectifiedBalances = [babzBal.toNumber(), babzBal.toNumber(), babzBal.toNumber(), 0];

    // upgrade controller contract
    const nextController = await MockController.new(power.address, pull.address, nutz.address, storage.address);
    const event1 = await RecoveryEvent.new(controller.address, nextController.address, VICTIMS, rectifiedBalances);
    await nextController.addAdmin(event1.address);
    await controller.addAdmin(event1.address);
    await event1.tick();
    await event1.tick();

    // check balance with next controller
    const balancesAfter = [(await nutz.balanceOf.call(VICTIMS[0])).toNumber(), (await nutz.balanceOf.call(VICTIMS[1])).toNumber(), (await nutz.balanceOf.call(VICTIMS[2])).toNumber(), (await nutz.balanceOf.call(SCAMMER)).toNumber()];

    assert.equal(balancesAfter[0], rectifiedBalances[0], 'recovery Not Successful');
    assert.equal(balancesAfter[1], rectifiedBalances[1], 'recovery Not Successful');
    assert.equal(balancesAfter[2], rectifiedBalances[2], 'recovery Not Successful');
    assert.equal(balancesAfter[3], rectifiedBalances[3], 'recovery Not Successful');
  });

});
