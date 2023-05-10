import { confidential } from 'liquidjs-lib';
import { ZKP } from '@vulpemventures/secp256k1-zkp';

export let zkpLib: ZKP;
export let confi: confidential.Confidential;

export const prepareConfidential = (zkp: ZKP) => {
  zkpLib = zkp;
  confi = new confidential.Confidential(zkp);
};
