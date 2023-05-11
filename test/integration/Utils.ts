import * as ecc from 'tiny-secp256k1';
import { SLIP77Factory } from 'slip77';
import { generateMnemonic } from 'bip39';
import {
  crypto,
  address,
  Transaction,
  networks,
  payments,
  TxOutput,
} from 'liquidjs-lib';
import {
  ECPairFactory,
  ECPairInterface,
  ECPairAPI,
  TinySecp256k1Interface,
} from 'ecpair';
import ChainClient from './utils/ChainClient';
import { ClaimDetails, RefundDetails } from '../../lib/consts/Types';
import { p2wpkhOutput, p2wshOutput } from '../../lib/swap/Scripts';
import {
  Networks,
  OutputType,
  detectSwap,
  constructClaimTransaction,
  constructRefundTransaction,
  targetFee,
} from '../../lib/Boltz';

export const bitcoinClient = new ChainClient({
  host: '127.0.0.1',
  port: 18884,
  rpcuser: 'elements',
  rpcpass: 'elements',
});

const tinysecp: TinySecp256k1Interface = ecc;
export const ECPair: ECPairAPI = ECPairFactory(tinysecp);

export const slip77 = SLIP77Factory(ecc).fromSeed(generateMnemonic());

export const destinationOutput = p2wpkhOutput(
  crypto.hash160(
    ECPair.makeRandom({ network: Networks.liquidRegtest }).publicKey!,
  ),
);

export const claimSwap = async (
  claimDetails: ClaimDetails,
  outputBlindingKey?: Buffer,
): Promise<void> => {
  const claimTransaction = targetFee(1, (fee) =>
    constructClaimTransaction(
      [claimDetails],
      destinationOutput,
      fee,
      true,
      networks.regtest.assetHash,
      outputBlindingKey,
    ),
  );

  await bitcoinClient.sendRawTransaction(claimTransaction.toHex());
};

export const refundSwap = async (
  refundDetails: RefundDetails,
  blockHeight: number,
): Promise<void> => {
  const refundTransaction = targetFee(1, (fee) =>
    constructRefundTransaction(
      [refundDetails],
      destinationOutput,
      blockHeight,
      fee,
      true,
      networks.regtest.assetHash,
    ),
  );

  await bitcoinClient.sendRawTransaction(refundTransaction.toHex());
};

export const createSwapDetails = async (
  generateScript: (
    preimageHash: Buffer,
    claimPublicKey: Buffer,
    refundPublicKey: Buffer,
    timeoutBlockHeight: number,
  ) => Buffer,
  preimage: Buffer,
  preimageHash: Buffer,
  claimKeys: ECPairInterface,
  refundKeys: ECPairInterface,
): Promise<{
  claimDetails: ClaimDetails[];
  refundDetails: RefundDetails[];
}> => {
  const claimDetails: ClaimDetails[] = [];
  const refundDetails: RefundDetails[] = [];

  for (let i = 0; i < 3; i += 1) {
    const claimOutputs = await createOutputs(
      generateScript,
      preimageHash,
      claimKeys,
      refundKeys,
      i != 0,
    );

    claimOutputs.forEach((out) => {
      claimDetails.push({
        preimage,
        keys: claimKeys,
        legacyTx: out.legacyTx,
        blindinkPrivKey: out.blindKey,
        redeemScript: out.redeemScript,
        ...out.swapOutput,
      });
    });

    const refundOutputs = await createOutputs(
      generateScript,
      preimageHash,
      claimKeys,
      refundKeys,
      i != 0,
    );

    refundOutputs.forEach((out) => {
      refundDetails.push({
        keys: refundKeys,
        blindinkPrivKey: out.blindKey,
        redeemScript: out.redeemScript,
        ...out.swapOutput,
      });
    });
  }

  return {
    claimDetails,
    refundDetails,
  };
};

const createOutputs = async (
  generateScript: (
    preimageHash: Buffer,
    claimPublicKey: Buffer,
    refundPublicKey: Buffer,
    timeoutBlockHeight: number,
  ) => Buffer,
  preimageHash: Buffer,
  claimKeys: ECPairInterface,
  refundKeys: ECPairInterface,
  blind: boolean,
) => {
  const { blocks } = await bitcoinClient.getBlockchainInfo();
  const timeoutBlockHeight = blocks + 1;

  const redeemScript = generateScript(
    preimageHash,
    claimKeys.publicKey!,
    refundKeys.publicKey!,
    timeoutBlockHeight,
  );

  return [
    await sendFundsToRedeemScript(
      p2wshOutput,
      OutputType.Bech32,
      redeemScript,
      timeoutBlockHeight,
      blind,
    ),
    await sendFundsToRedeemScript(
      p2wshOutput,
      OutputType.Bech32,
      redeemScript,
      timeoutBlockHeight,
      blind,
    ),
    await sendFundsToRedeemScript(
      p2wshOutput,
      OutputType.Bech32,
      redeemScript,
      timeoutBlockHeight,
      blind,
    ),
  ];
};

export const sendFundsToRedeemScript = async (
  outputFunction: (scriptHex: Buffer) => Buffer,
  outputType: OutputType,
  redeemScript: Buffer,
  timeoutBlockHeight: number,
  blind: boolean,
): Promise<{
  redeemScript: Buffer;
  timeoutBlockHeight: number;
  legacyTx: Transaction;
  blindKey?: Buffer;
  swapOutput: TxOutput & {
    vout: number;
    txHash: Buffer;
    type: OutputType;
  };
}> => {
  const outputScript = outputFunction(redeemScript);
  let swapAddress = address.fromOutputScript(
    outputScript,
    Networks.liquidRegtest,
  );

  let blindKey: Buffer | undefined;

  if (blind) {
    const blindKeys = slip77.derive(outputScript);
    const blinded = payments.p2wsh({
      output: outputScript,
      network: Networks.liquidRegtest,
      blindkey: blindKeys.publicKey!,
    });
    blindKey = blindKeys.privateKey;
    swapAddress = blinded.confidentialAddress!;
  }

  const transactionId = await bitcoinClient.sendToAddress(swapAddress, 10000);
  const transaction = Transaction.fromHex(
    (await bitcoinClient.getRawTransaction(transactionId)) as string,
  );

  const output = detectSwap(redeemScript, transaction)!;

  return {
    blindKey,
    redeemScript,
    timeoutBlockHeight,
    legacyTx: transaction,
    swapOutput: {
      ...output,
      txHash: transaction.getHash(),
      type: outputType,
    },
  };
};
