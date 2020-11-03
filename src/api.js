const axios = require('axios');
const OPT_DEFAULTS = {
  baseUrl: 'https://api.ethos.io/wallet-recovery',
};
module.exports = function (opts) {
  const _opts = {
    ...OPT_DEFAULTS,
    ...(opts || {}),
  };
  const axios = require('axios').create({ baseURL: _opts.baseURL });

  const checkErrorStatus = (data) => {
    if (data.status === 'error') {
      console.log('An unknown server error occurred. Please try again later.');
      process.exit(2);
    }
  }
  return {
    getUtxos: async (blockchain, addr) => {
      try {
        const { data } = await axios.get(`/${ blockchain }/utxos/${ addr }`);
        checkErrorStatus(data);
        if (data && (data.status === 'empty' || !Array.isArray(data.utxos) || data.utxos.length === 0)) {
          console.log(`Wallet address ${ addr } has no funds to use.`);
          process.exit(2);
        }
        if (!data || !data.utxos) {
          console.log('Bad Response');
          throw new Error('Bad Response');
        }
        return data.utxos;
      } catch (e) {
        console.log(`ERROR: Cannot load UTXO details for address ${ addr }`);
        console.debug(`DETAILS: ${ JSON.stringify(e, null, 2) }`);
        process.exit(1);
      }
    },

    submitSignedTransaction: async (blockchain, txHex) => {
      try {
        const { data } = await axios.post(`/${ blockchain }/tx`, { txHex });
        checkErrorStatus(data);
        if (!data || !data.transactionHash) {
          console.log('Bad Response');
          throw new Error('Bad Response');
        }
        return data;
      } catch (e) {
        console.log(`ERROR: Failed to communicate with server to send transaction. e = ${ e }`);
        process.exit(1);
      }
    }
  };
};