import { Transaction } from 'liquidjs-lib';

export const targetFee = (
  satPerVbyte: number,
  constructTx: (fee: number) => Transaction,
) => {
  const tx = constructTx(1);
  return constructTx(Math.ceil(tx.virtualSize() * satPerVbyte));
};
