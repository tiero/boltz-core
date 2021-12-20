import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { getHexBuffer } from '../../../lib/Utils';
import { OutputType } from '../../../lib/consts/Enums';
import { RefundDetails } from '../../../lib/consts/Types';
import { constructRefundTransaction } from '../../../lib/swap/Refund';
import { LBTC_REGTEST } from './Utils';
import { Nonce } from '../../../lib/consts/Buffer';
import { satoshiToConfidentialValue } from 'liquidjs-lib/types/confidential';
import { regtest } from 'liquidjs-lib/types/networks';

const bip32 = BIP32Factory(ecc);

describe('Refund', () => {
  const utxo = {
    txHash: getHexBuffer('285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d754'),
    vout: 0,
    value: satoshiToConfidentialValue(2000),

    keys: bip32.fromBase58('xprv9xgxR6htMdXUXGipynZp1janNrWNYJxaz2o4tH9fdtZqcF26BX5VB88GSM5KgZHWCyAyb8FZpQik2UET84CHfGWXFMG5zWWjmtDMgqYuo19'),
    redeemScript: getHexBuffer('a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac'),
  };

  const refundDetails = [
    {
      ...utxo,
      type: OutputType.Bech32,
      script: getHexBuffer('00206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9e'),
      asset: LBTC_REGTEST,
      nonce: Nonce,
    },
    {
      ...utxo,
      type: OutputType.Legacy,
      script: getHexBuffer('a9143cdeb56e328a10d3bfe107fd5a16bd73871adb8d87'),
      asset: LBTC_REGTEST,
      nonce: Nonce,
    },
    {
      ...utxo,
      type: OutputType.Compatibility,
      script: getHexBuffer('a9148f439aff651860bdb28c66500c6e958cfbe7a69387'),
      asset: LBTC_REGTEST,
      nonce: Nonce,
    },
  ];

  const testRefund = (utxos: RefundDetails[]) => {
    return constructRefundTransaction(
      utxos,
      getHexBuffer('00140000000000000000000000000000000000000000'),
      11,
      1,
      true,
      regtest.assetHash
    );
  };

  test('should refund a P2WSH swap', () => {
    const expected = '01000000000101285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d7540000000000fdffffff015107000000000000160014000000000000000000000000000000000000000003473044022001ec0e4acead9cc62047403df7752b0760b9f5fd8e50cbc9e363e698f00d6bc502207d132feddf67cf9dd800d6591920fb116b9b46f8080c53357344c7a6cf75fb83010064a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac0b000000';

    expect(testRefund([
      refundDetails[0],
    ]).toHex()).toEqual(expected);
  });

  test('should refund a P2SH swap', () => {
    const expected = '0100000001285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000af473044022001c3dbb2ece8ccba1e523b4e47cceaa1f0dae9b9e344af2f612604a387c41da602201b0ece06de76cc24820623a5eac7a00cf59fdc5b9d2cd8ee5dcdb5625ed4bd9101004c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368acfdffffff01ce0600000000000016001400000000000000000000000000000000000000000b000000';

    expect(testRefund([
      refundDetails[1],
    ]).toHex()).toEqual(expected);
  });

  test('should refund a P2SH nested P2WSH swap', () => {
    const expected = '01000000000101285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000232200206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9efdffffff012e070000000000001600140000000000000000000000000000000000000000034830450221008e25e3f4c50c093641aea31b9e66555e14a8984493e89277beac61a91cce1bd902205743f99091eb45fc2db8c97ae5b69cd1ed04188294c3055cbdf0118ee472ee5f010064a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac0b000000';

    expect(testRefund([
      refundDetails[2],
    ]).toHex()).toEqual(expected);
  });

  test('should refund multiple swaps in one transaction', () => {
    const expected = '01000000000103285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d7540000000000fdffffff285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000af47304402201299de809dc2c67408c50940e7e35dfc4755b2ae0c152b7214f10ee308ad258802203ccc8d517504c587d522d281b587faf27a3d9e952fa7aae54abb6f22eb17c5d101004c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368acfdffffff285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000232200206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9efdffffff019e1500000000000016001400000000000000000000000000000000000000000347304402206054593b7a7ae1406ccdbcf42c6cf2a84d9e37d62a1fbb3eeee4cd249c70e834022054c92abe3d7793dabd9676b1e49bbe80e7137759874ec9e0de75ae2bb942edf2010064a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac000347304402206054593b7a7ae1406ccdbcf42c6cf2a84d9e37d62a1fbb3eeee4cd249c70e834022054c92abe3d7793dabd9676b1e49bbe80e7137759874ec9e0de75ae2bb942edf2010064a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac0b000000';

    expect(testRefund(refundDetails).toHex()).toEqual(expected);
  });
});
