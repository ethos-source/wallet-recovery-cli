const {
  Bip32PrivateKey,
  ByronAddress,
  NetworkInfo,
} = require('@emurgo/cardano-serialization-lib-nodejs');

const BigNumber = require('bignumber.js');

const { CardanoTransaction } = require('./transactions');
const cardanoAddresses = require('./addresses');

let Api;
let utxos;
let tx;
let fee;
let transferAmount;
let currentState = {
  computed: {},
};

function computeState() {
  const computed = currentState.computed || {};
  if (currentState.xPrv && !computed.prvKeyObj) {
    computed.prvKeyObj = Bip32PrivateKey.from_bytes(Buffer.from(currentState.xPrv, 'hex'));
  }
  if (computed.prvKeyObj && !computed.pubKeyObj) {
    computed.pubKeyObj = computed.prvKeyObj.to_public();
  }
  debug(`computeState: ${ format(computed) }`);
  if (computed.pubKeyObj && !computed.walletAddr) {
    const addr = ByronAddress.icarus_from_key(computed.pubKeyObj, NetworkInfo.mainnet().protocol_magic()).to_base58();
    computed.walletAddr = cardanoAddresses.getByronAddress(addr);
  }
  if (currentState.destAddr && !computed.destAddr) {
    computed.destAddr = cardanoAddresses.getAddress(currentState.destAddr);
  }
  return computed;
}

const format = (obj) => JSON.stringify(obj, null, 2);
const debug = (out) => { if (currentState.DEBUG) console.debug(out) };

const convert = (amt) => new BigNumber(amt).shiftedBy(-6).toString();

async function updateState(newState) {
  debug(`Current State: ${ format(currentState) }`);
  debug(`Pending New State: ${ format(newState) }`);
  if (newState) {
    currentState = {...currentState, ...newState};
    const computed = computeState();
    currentState = {...currentState, computed};
    debug(`Updated State: ${ format(currentState) }`);
  }
}

const walletAddress = () => currentState.computed.walletAddr;
const destAddress = () => currentState.computed.destAddr;
const privateKey = () => currentState.computed.prvKeyObj;

async function getUtxos() {
  if (!currentState.computed.walletAddr) {
    throw new Error('WalletAddress must be set before calling state.getUtxos');
  }
  if (utxos) return utxos;
  utxos = await Api.getUtxos('ada', walletAddress().toString());
  return utxos;
}

async function getTransferAmount() {
  await getTx();
  return convert(transferAmount);
}

async function getFee() {
  if (!fee) await getTx();
  return convert(fee);
}

async function getTx() {
  if (tx) return tx;
  tx = new CardanoTransaction(privateKey(), walletAddress());
  await tx.addInputs(getUtxos);
  const res = await tx.sendAll(destAddress());
  fee = res.fee;
  transferAmount = res.transferAmount;
  return tx;
}

async function submitTx() {
  const details = (await getTx()).build();
  debug(`Signed tx: ${ details.txBody }`);
  const encoded = Buffer.from(JSON.stringify(details)).toString('hex');
  const res = await Api.submitSignedTransaction('ada', encoded);
  return details;
}

module.exports = function(_Api) {
  Api = _Api;
  return {
    destAddress,
    walletAddress,
    getFee,
    submitTx,
    getTransferAmount,
    updateState,
  }
};