const Wasm = require('@emurgo/cardano-serialization-lib-nodejs');
const { Address, ByronAddress } = Wasm;

function getAddressObject(addrStr, convertToWasm) {
  try {
    const wasmObject = convertToWasm(addrStr);
    return {
      value: addrStr,
      toString: () => addrStr,
      toWasmObject: () => wasmObject,
      toWasmBase: () => ('to_address' in wasmObject) ? wasmObject.to_address() : wasmObject,
    };
  } catch (e) {
    return undefined;
  }
}

const getShelleyAddress = (addr) => getAddressObject(addr, Address.from_bech32);
const getByronAddress = (addr) => getAddressObject(addr,  ByronAddress.from_base58);
const getAddress = (addr) => getShelleyAddress(addr) || getByronAddress(addr);

const isValidShelleyAddress = (addr) => !!getShelleyAddress(addr);
const isValidByronAddress = (addr) => !!getByronAddress(addr);
const isValidAddress = (addr) => isValidShelleyAddress(addr) || isValidByronAddress(addr);

module.exports = {
  getAddress,
  getShelleyAddress,
  isValidShelleyAddress,
  getByronAddress,
  isValidByronAddress,
  isValidAddress,
};