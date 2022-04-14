const { isValidAddress } = require('./cardano/addresses');

const prompts = require('prompts');

const args = require('yargs/yargs')(process.argv.slice(2)).argv;

const Api = args.TEST ? require('./mockApi')(args) : require('./api')(args);
const state = require('./cardano/state')(Api);
state.updateState(args);

const validateXPrv = (xPrv) => {
  let buf;
  try {
    buf = Buffer.from(xPrv.trim(), 'hex');
  } catch (e) {
    return 'Private key should be a hex-encoded string';
  }
  if (buf.length !== 96) return `Private key should be 192 characters in length (got ${ xPrv.length })`;
  return true;
};

console.log('*** Ethos Wallet Recovery CLI ***');
console.log();

const description =
` This utility will construct a transaction to recover Cardano funds held in an
Ethos Universal Wallet address. You must provide the private key for the
address which can be generated from the BIP39 tool located at:

  https://ethos-source.github.io/bip39-web-tool/

 You must also provide a destination address to forward the funds from your
wallet address. Once the private key and destination address have been
verified, a transaction will be submitted to transfer all funds to the
destination address.

 Your private key will never be transmitted during this operation.
`;

console.log(description);
console.log();

const questions = [
  {
    type: 'text',
    name: 'xPrv',
    message: 'Private key of the wallet to recover:',
    format: (val) => val.trim(),
    validate: validateXPrv,
  },
  {
    type: 'text',
    name: 'destAddr',
    message: 'Address to forward the funds:',
    format: val => val.trim(),
    validate: (addr) => isValidAddress(addr) ? true : 'Invalid Cardano address',
  },
  {
    type: 'confirm',
    name: 'confirmFee',
    message: async (_, { xPrv, destAddr }) => {
      return `Transferring funds will cost ${ await state.getFee() } ADA. Is this OK?`;
    },
    initial: false,
  },
  {
    type: prev => prev ? 'confirm' : null,
    name: 'confirmTx',
    message: async (_, { destAddr }) => {
      return `This operation will send ${
        await state.getTransferAmount()
      } ADA from ${ state.walletAddress() } to ${ state.destAddress() }. Do you wish to proceed?`;
    },
    initial: false,
  }
];

prompts.override(args);

async function runRecoveryTransaction() {
  const onSubmit = (_, __, answers) => {
    state.updateState(answers);
  };

  const response = await prompts(questions, { onSubmit });

  let details;
  try {
    details = await state.submitTx();
    console.log(`Successfully sent transaction.`);
  } catch(e) {
    console.log(e);
    console.log('Possible failure occurred while sending transaction. Please try again if transaction is not confirmed.');
  }
  if (details && details.txHash) {
    console.log(`Transaction hash: ${ details.txHash }`);
    console.log(`View at: https://explorer.cardano.org/en/transaction?id=${ details.txHash }`);
  }
}

(async () => {
  while(1) {
    await runRecoveryTransaction();
    
    const response = await prompts({
      type: 'confirm',
      name: 'processNext',
      message: 'Operation complete. Do you want to send another transaction?',
    });

    if (!response.processNext) {
      process.exit(0);
    }
  }
})()





