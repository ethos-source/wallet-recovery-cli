const {
  Bip32PrivateKey,
  BootstrapWitnesses,
  ByronAddress,
  hash_transaction,
  make_icarus_bootstrap_witness,
  LinearFee,
  Transaction,
  TransactionBuilder,
  TransactionHash,
  TransactionInput,
  TransactionOutput,
  TransactionWitnessSet,
  BigNum,
} = require('@emurgo/cardano-serialization-lib-nodejs');

const MIN_UTXO_VALUE = '1000000'; // 1 ADA is the smallest output that can be created
const FIXED_FEE = '155381';       // Network-wide fixed cost per tx
const FEE_PER_BYTE = '44';        // Network-wide fee per transaction byte

class CardanoTransaction {

  /**
   * @param { Bip32PrivateKey } senderXPrv
   * @param { ByronAddress } senderAddr
   */
  constructor(senderXPrv, senderAddr) {
    this.senderXPrv = senderXPrv;
    this.senderAddr = senderAddr;
    this.balance = BigNum.from_str('0');

    this.tx = TransactionBuilder.new(
      LinearFee.new(
        BigNum.from_str(FEE_PER_BYTE),
        BigNum.from_str(FIXED_FEE),
      ),
      BigNum.from_str(MIN_UTXO_VALUE),
      BigNum.from_str('500000000'),
      BigNum.from_str('2000000'),
    );

    this.tx.set_ttl(31536000);
  }

  async addInputs(fetchCb) {
    const inputs = await fetchCb();

    this.inputs = inputs;

    inputs.forEach(utxo => {
      const amount = this._addBuilderInput(utxo);
      this.balance = this.balance.checked_add(amount);
    });

    if (inputs.length === 0) {
      console.log('ERROR: Wallet address does not have funds to transfer');
      process.exit(1);
    }

    return this;
  }

  _addBuilderInput(utxo) {
    const hash = TransactionHash.from_bytes(
      Buffer.from(utxo.txHash, 'hex'),
    );
    const amount = BigNum.from_str(utxo.coins);
    const txInput = TransactionInput.new(hash, utxo.outputIndex);

    this.tx.add_bootstrap_input(
      this.senderAddr.toWasmObject(),
      txInput,
      amount,
    );
    return amount;
  }

  async sendAll(destAddr) {
    this.destAddr = destAddr;
    const fee = this.computeFee();

    const sendAmount = this.balance.checked_sub(fee);
    this.tx.set_fee(fee);
    this._setOutputAmount(sendAmount.to_str());
    const res = {
      fee: fee.to_str(),
      transferAmount: sendAmount.to_str(),
    };
    return res;
  }

  _setOutputAmount(amount) {
    if (!this.destAddr) throw new Error('Destination address not set');
    const amtBigNum = BigNum.from_str(amount);
    const address = this.destAddr.toWasmBase();
    const txOutput = TransactionOutput.new(address, amtBigNum);
    this.tx.add_output(txOutput);
  }

  _generateWitness(txHash) {
    const witnessSet = TransactionWitnessSet.new();

    const bootstrapWitness = make_icarus_bootstrap_witness(
      txHash,
      this.senderAddr.toWasmObject(),
      this.senderXPrv,
    );

    const bootstrapWitnesses = BootstrapWitnesses.new();
    bootstrapWitnesses.add(bootstrapWitness);
    witnessSet.set_bootstraps(bootstrapWitnesses);

    return witnessSet;
  }

  build() {
    const txBody = this.tx.build();
    const txHash = hash_transaction(txBody);

    const finalTransaction = Transaction.new(
      txBody,
      this._generateWitness(txHash),
      undefined, // no transaction metadata
    );

    return {
      txHash: Buffer.from(txHash.to_bytes()).toString('hex'),
      txBody: Buffer.from(finalTransaction.to_bytes()).toString('hex'),
    };
  }

  computeFee() {
    /* Build tx to compute size for fee calculation */
    const clone = this.clone();
    clone._setOutputAmount(MIN_UTXO_VALUE);
    clone.tx.add_change_if_needed(this.senderAddr.toWasmBase());
    const mockTx = clone.build();
    const sizeBytes = BigNum.from_str((mockTx.txBody.length / 2).toString());
    const varFee = BigNum.from_str(FEE_PER_BYTE).checked_mul(sizeBytes);
    return BigNum.from_str(FIXED_FEE).checked_add(varFee);
  }

  clone() {
    const cloneObj = new CardanoTransaction(this.senderXPrv, this.senderAddr);
    if (this.inputs) {
      cloneObj.inputs = this.inputs;
      this.inputs.forEach(utxo => cloneObj._addBuilderInput(utxo));
    }
    cloneObj.balance = this.balance;
    cloneObj.fee = this.fee;
    cloneObj.destAddr = this.destAddr;
    return cloneObj;
  }

}

module.exports = {
  CardanoTransaction
};