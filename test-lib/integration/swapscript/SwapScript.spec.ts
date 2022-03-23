import { randomBytes } from 'crypto';
import { constructClaimTransaction, constructRefundTransaction , Networks, swapScript } from '../../../lib/Boltz';
import { bitcoinClient, createSwapDetails, ECPair, destinationOutput, claimSwap, refundSwap } from '../Utils';
import { networks , crypto } from 'liquidjs-lib';
import { getHexBuffer } from '../../../lib/Utils';
import { RefundDetails, ClaimDetails } from '../../../lib/consts/Types';


export let claimDetails: ClaimDetails[] = [];
export let refundDetails: RefundDetails[] = [];




describe('SwapScript claim', () => {

  const claimKeys = ECPair.makeRandom({ network: Networks.liquidRegtest });
  const refundKeys = ECPair.makeRandom({ network: Networks.liquidRegtest });

  const preimage = getHexBuffer('b5b2dbb1f0663878ecbc20323b58b92c');
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

  test('should send funds to swaps', async () => {
    const details = await createSwapDetails(
      swapScript,
      preimage,
      preimageHash,
      claimKeys,
      refundKeys,
    );

    claimDetails = details.claimDetails;
    refundDetails = details.refundDetails;


    expect(claimDetails.length).toEqual(6);
    expect(refundDetails.length).toEqual(6);
  });

  test('should not claim swaps if the preimage has an invalid hash', async () => {
    let actualError: any;

    try {
      const toClaim = {
        ...claimDetails[0],
      };
      toClaim.preimage = randomBytes(32);

      await claimSwap(toClaim);
    } catch (error) {
      actualError = error;
    }

    expect(actualError.code).toEqual(-26);
    expect(actualError.message).toEqual('mandatory-script-verify-flag-failed (Locktime requirement not satisfied)');
  });

  test('should claim a P2WSH swap', async () => {
    await claimSwap(claimDetails[0]);
  });

  test('should claim a P2SH swap', async () => {
    await claimSwap(claimDetails[1]);
  });

  test('should claim a P2SH nested P2WSH swap', async () => {
    await claimSwap(claimDetails[2]);
  });

  test('should claim multiple swaps in one transaction', async () => {
    const claimTransaction = constructClaimTransaction(
      claimDetails.slice(3, 6),
      destinationOutput,
      1,
      true,
      networks.regtest.assetHash
    );

    await bitcoinClient.sendRawTransaction(claimTransaction.toHex());
  });


  test('should refund a P2WSH swap', async () => {
    await refundSwap(refundDetails[0], bestBlockHeight);
  });

  test('should refund a P2SH swap', async () => {
    await refundSwap(refundDetails[1], bestBlockHeight);
  });

  test('should refund a P2SH nested P2WSH swap', async () => {
    await refundSwap(refundDetails[2], bestBlockHeight);
  });

  test('should refund multiple swaps in one transaction', async () => {
    const refundTransaction = constructRefundTransaction(
      refundDetails.slice(3, 6),
      destinationOutput,
      bestBlockHeight,
      1,
      true,
      networks.regtest.assetHash
    );

    await bitcoinClient.sendRawTransaction(refundTransaction.toHex());
  });
});
