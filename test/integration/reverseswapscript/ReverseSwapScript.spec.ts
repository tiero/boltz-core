import { randomBytes } from 'crypto';
import { networks , crypto } from 'liquidjs-lib';
import {
  constructClaimTransaction,
  Networks,
  reverseSwapScript,
  OutputType,
  targetFee,
  constructRefundTransaction,
} from "../../../lib/Boltz";
import { bitcoinClient, createSwapDetails, sendFundsToRedeemScript, refundSwap, ECPair, destinationOutput, claimSwap } from '../Utils';
import { getHexBuffer } from '../../../lib/Utils'; 
import { p2wshOutput } from '../../../lib/swap/Scripts';
import { ClaimDetails, RefundDetails } from '../../../lib/consts/Types';



export let invalidPreimageLengthSwap: ClaimDetails;

export let claimDetails: ClaimDetails[] = [];
export let refundDetails: RefundDetails[] = [];


describe('ReverseSwapScript claim', () => {
  const claimKeys = ECPair.makeRandom({ network: Networks.liquidRegtest });
  const refundKeys = ECPair.makeRandom({ network: Networks.liquidRegtest });

  const invalidPreimage = getHexBuffer('b5b2dbb1f0663878ecbc20323b58b92c');
  const invalidPreimageHash = crypto.sha256(invalidPreimage);

  const preimage = getHexBuffer('9b2b702b8fd1cbd1375b3a63a840b8a02c318d93309e8df3203e120045dd0ae0');
  const preimageHash = crypto.sha256(preimage);

  let bestBlockHeight: number;

  beforeAll(async () => {
    await bitcoinClient.init();
  });

  beforeEach(async () => {
    await bitcoinClient.generate(1);

    const { blocks } = await bitcoinClient.getBlockchainInfo();
    // Although it is possible that the height of the best block is not the height at which
    // the HTLC times out one can assume that the best block is already after the timeout
    bestBlockHeight = blocks;
  });


  test('should send funds to reverse swaps', async () => {
    const details = await createSwapDetails(
      reverseSwapScript,
      preimage,
      preimageHash,
      claimKeys,
      refundKeys,
    );

    const { blocks } = await bitcoinClient.getBlockchainInfo();
    const timeoutBlockHeight = blocks + 1;

    const redeemScript = reverseSwapScript(invalidPreimageHash, claimKeys.publicKey!, refundKeys.publicKey!, timeoutBlockHeight);

    const invalidOutput = await sendFundsToRedeemScript(
      p2wshOutput,
      OutputType.Bech32,
      redeemScript,
      timeoutBlockHeight,
    );

    invalidPreimageLengthSwap = {
      redeemScript,
      keys: claimKeys,
      preimage: invalidPreimage,
      ...invalidOutput.swapOutput,
    };

    claimDetails = details.claimDetails;
    refundDetails = details.refundDetails;

    expect(claimDetails.length).toEqual(6);
    expect(refundDetails.length).toEqual(6);
  });

  test('should not claim reverse swaps if the preimage has an invalid length', async () => {
    let actualError: any;

    try {
      await claimSwap(invalidPreimageLengthSwap);
    } catch (error) {
      // If the preimage has in invalid length the refund key is loaded and the signature is verified against it
      actualError = error;
    }

    expect(actualError.code).toEqual(-26);
    expect(actualError.message).toEqual('non-mandatory-script-verify-flag (Locktime requirement not satisfied)');
  });

  test('should not claim reverse swaps if the preimage has a valid length but an invalid hash', async () => {
    let actualError: any;

    try {
      const toClaim = {
        ...invalidPreimageLengthSwap,
      };
      toClaim.preimage = randomBytes(32);

      await claimSwap(toClaim);
    } catch (error) {
      actualError = error;
    }

    expect(actualError.code).toEqual(-26);
    expect(actualError.message).toEqual('non-mandatory-script-verify-flag (Script failed an OP_EQUALVERIFY operation)');
  });

  test('should claim a P2WSH reverse swap', async () => {
    await claimSwap(claimDetails[0]);
  });

  test('should claim a P2SH reverse swap', async () => {
    await claimSwap(claimDetails[1]);
  });

  test('should claim a P2SH nested P2WSH reverse swap', async () => {
    await claimSwap(claimDetails[2]);
  });

  test('should claim multiple reverse swaps in one transaction', async () => {
    const claimTransaction = targetFee(1, (fee) => constructClaimTransaction(
        claimDetails.slice(3, 6),
        destinationOutput,
        fee,
        false,
        networks.regtest.assetHash
      ),
    );

    await bitcoinClient.sendRawTransaction(claimTransaction.toHex());
  });


  test('should refund a P2WSH reverse swap', async () => {
    await refundSwap(refundDetails[0], bestBlockHeight);
  });

  test('should refund a P2SH reverse swap', async () => {
    await refundSwap(refundDetails[1], bestBlockHeight);
  });

  test('should refund a P2SH nested P2WSH reverse swap', async () => {
    await refundSwap(refundDetails[2], bestBlockHeight);
  });

  test('should refund multiple reverse swaps in one transaction', async () => {
    const refundTransaction = targetFee(1, (fee) => constructRefundTransaction(
        refundDetails.slice(3, 6),
        destinationOutput,
        bestBlockHeight,
        fee,
        true,
        networks.regtest.assetHash
      ),
    );

    await bitcoinClient.sendRawTransaction(refundTransaction.toHex());
  });
});
