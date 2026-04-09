import algosdk from "algosdk";

/**
 * Builds a transaction to split incoming contract payments between the Sensei and the Dojo.
 * Default split is 95/5 in favor of the Sensei.
 */
export function buildSplitPaymentTxn(
  sender: string,
  splitterAppId: number,
  params: algosdk.SuggestedParams,
  paymentAmount: number
) {
  const enc = new TextEncoder();
  
  // Call the 'split' method on the payout splitter application
  return algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    suggestedParams: params,
    appIndex: splitterAppId,
    appArgs: [
      enc.encode("split"),
      algosdk.encodeUint64(paymentAmount)
    ],
  });
}

/**
 * Opt-in an agent account to the splitter application state.
 */
export function buildOptInSplitterTxn(
  sender: string,
  splitterAppId: number,
  params: algosdk.SuggestedParams
) {
  return algosdk.makeApplicationOptInTxnFromObject({
    sender,
    suggestedParams: params,
    appIndex: splitterAppId,
  });
}

/**
 * Builds an atomic transaction group for agent licensing fees.
 * Txn 1: 80% to Sensei (agent owner)
 * Txn 2: 20% to Treasury
 */
export async function buildLicensingPaymentGroup(params: {
  algodClient: algosdk.Algodv2,
  licenseeAddress: string,
  senseiAddress: string,
  treasuryAddress: string,
  feeAmountAlgo: bigint,
  signer: algosdk.TransactionSigner
}): Promise<algosdk.AtomicTransactionComposer> {
  const { algodClient, licenseeAddress, senseiAddress, treasuryAddress, feeAmountAlgo, signer } = params;
  const sp = await algodClient.getTransactionParams().do();
  const atc = new algosdk.AtomicTransactionComposer();

  const senseiShare = (feeAmountAlgo * BigInt(80)) / BigInt(100);
  const treasuryShare = (feeAmountAlgo * BigInt(20)) / BigInt(100);

  // Txn 1: Payment to Sensei
  const senseiTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: licenseeAddress,
    receiver: senseiAddress,
    amount: senseiShare,
    suggestedParams: sp,
  });

  // Txn 2: Payment to Treasury
  const treasuryTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: licenseeAddress,
    receiver: treasuryAddress,
    amount: treasuryShare,
    suggestedParams: sp,
  });

  atc.addTransaction({ txn: senseiTxn, signer });
  atc.addTransaction({ txn: treasuryTxn, signer });

  return atc;
}
