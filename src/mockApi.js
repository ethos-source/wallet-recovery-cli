const crypto = require('crypto');

const randomTxHash = () => crypto.randomBytes(32).toString('hex');

module.exports = function () {

  return {
    getUtxos: async (_, address) => {
      return ['1000000', '2000000', '3000000'].map((coins, idx) => ({
        address,
        coins,
        outputIndex: idx,
        txHash: randomTxHash(),
      }));
    },

    submitSignedTransaction: async (blockchain, txHex) => ({
      status: 'Success',
      txHash: randomTxHash(),
    }),
  };
};