import algosdk from 'algosdk';

export interface StakeParams {
    algodClient: algosdk.Algodv2;
    commitmentAppId: number;
    senderAddress: string;
    stakeId: string;
    amountAlgo: bigint;
    lockDays: number;
    signer: algosdk.TransactionSigner;
}

/**
 * Builds an atomic transaction group to stake ALGO in the CommitmentLock contract.
 * Method: stake(string,address,uint64,uint64,pay)bool
 */
export async function buildStakeCommitmentATC(params: StakeParams) {
    const { 
        algodClient, 
        commitmentAppId, 
        senderAddress, 
        stakeId, 
        amountAlgo, 
        lockDays, 
        signer 
    } = params;
    
    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    const appAddr = algosdk.getApplicationAddress(commitmentAppId);

    // 1. Payment (ALGO) to Contract
    const stakeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: senderAddress,
        receiver: appAddr,
        amount: amountAlgo,
        suggestedParams: sp,
    });

    // 2. Defining ABI for stake method
    const abi = new algosdk.ABIInterface({
        name: 'CommitmentLock',
        methods: [
            {
                name: 'stake',
                args: [
                    { type: 'string', name: 'stake_id' },
                    { type: 'address', name: 'sensei' },
                    { type: 'uint64', name: 'amount' },
                    { type: 'uint64', name: 'lock_days' },
                    { type: 'pay', name: 'stake_txn' }
                ],
                returns: { type: 'bool' }
            }
        ]
    });

    atc.addMethodCall({
        appID: BigInt(commitmentAppId),
        method: abi.getMethodByName('stake'),
        methodArgs: [
            stakeId,
            senderAddress,
            amountAlgo,
            BigInt(lockDays),
            { txn: stakeTxn, signer }
        ],
        sender: senderAddress,
        signer,
        suggestedParams: sp,
    });

    return atc;
}

/**
 * Builds a transaction to withdraw a stake after the lock period.
 */
export async function buildWithdrawStakeATC(params: {
    algodClient: algosdk.Algodv2;
    commitmentAppId: number;
    senderAddress: string;
    stakeId: string;
    signer: algosdk.TransactionSigner;
}) {
    const { algodClient, commitmentAppId, senderAddress, stakeId, signer } = params;
    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();

    const abi = new algosdk.ABIInterface({
        name: 'CommitmentLock',
        methods: [
            {
                name: 'withdraw',
                args: [{ type: 'string', name: 'stake_id' }],
                returns: { type: 'bool' }
            }
        ]
    });

    atc.addMethodCall({
        appID: BigInt(commitmentAppId),
        method: abi.getMethodByName('withdraw'),
        methodArgs: [stakeId],
        sender: senderAddress,
        signer,
        suggestedParams: sp,
    });

    return atc;
}

/**
 * Combined atomic group to stake ALGO and update agent status in registry.
 */
export async function buildStakeAndListAtomicGroup(params: {
    algodClient: algosdk.Algodv2;
    senseiAddress: string;
    agentAddress: string;
    stakeAmountAlgo: bigint;
    durationDays: number;
    commitmentLockAppId: number;
    dojoRegistryAppId: number;
    signer: algosdk.TransactionSigner;
}) {
    const { 
        algodClient, 
        senseiAddress, 
        agentAddress, 
        stakeAmountAlgo, 
        durationDays, 
        commitmentLockAppId, 
        dojoRegistryAppId, 
        signer 
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    const lockAddr = algosdk.getApplicationAddress(commitmentLockAppId);

    // 1. Stake Transaction (Payment)
    const stakeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: senseiAddress,
        receiver: lockAddr,
        amount: stakeAmountAlgo,
        suggestedParams: sp,
    });

    // 2. CommitmentLock.stake call
    const lockAbi = new algosdk.ABIInterface({
        name: 'CommitmentLock',
        methods: [{
            name: 'stake',
            args: [
                { type: 'string', name: 'stake_id' },
                { type: 'address', name: 'sensei' },
                { type: 'uint64', name: 'amount' },
                { type: 'uint64', name: 'lock_days' },
                { type: 'pay', name: 'stake_txn' }
            ],
            returns: { type: 'bool' }
        }]
    });

    atc.addMethodCall({
        appID: BigInt(commitmentLockAppId),
        method: lockAbi.getMethodByName('stake'),
        methodArgs: [
            agentAddress,
            senseiAddress,
            stakeAmountAlgo,
            BigInt(durationDays),
            { txn: stakeTxn, signer }
        ],
        sender: senseiAddress,
        signer,
        suggestedParams: sp,
    });

    return atc;
}
