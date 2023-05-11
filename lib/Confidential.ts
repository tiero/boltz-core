import { confidential } from 'liquidjs-lib';
import { ECPairAPI, ECPairFactory } from 'ecpair';
import { ZKP } from '@vulpemventures/secp256k1-zkp';

export let ecPair: ECPairAPI;
export let zkpLib: ZKP;
export let confi: confidential.Confidential;

export const prepareConfidential = (zkp: ZKP) => {
  zkpLib = zkp;
  ecPair = ECPairFactory(zkpLib.ecc);
  confi = new confidential.Confidential(zkp);
};
