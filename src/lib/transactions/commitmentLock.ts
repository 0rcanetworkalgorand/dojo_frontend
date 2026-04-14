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
 * Combined atomic group to stake USDC and update agent status in registry.
 * Txn 1: USDC transfer to CommitmentLock
 * Txn 2: CommitmentLock.stake(stake_id, sensei, amount, lock_days, stake_txn)
 * Txn 3: DojoRegistry.list_agent(agent_id, expiry)
 */
export async function buildStakeAndListAtomicGroup(params: {
    algodClient: algosdk.Algodv2;
    senseiAddress: string;
    agentAddress: string;
    stakeAmountUsdc: bigint;
    durationDays: number;
    commitmentLockAppId: number;
    dojoRegistryAppId: number;
    usdcAssetId: number;
    signer: algosdk.TransactionSigner;
}) {
    const { 
        algodClient, 
        senseiAddress, 
        agentAddress, 
        stakeAmountUsdc, 
        durationDays, 
        commitmentLockAppId, 
        dojoRegistryAppId, 
        usdcAssetId,
        signer 
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    const lockAddr = algosdk.getApplicationAddress(commitmentLockAppId);

    // 1. Stake Transaction (Asset Transfer - USDC)
    const stakeTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: senseiAddress,
        receiver: lockAddr,
        assetIndex: usdcAssetId,
        amount: stakeAmountUsdc,
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
                { type: 'axfer', name: 'stake_txn' }
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
            stakeAmountUsdc,
            BigInt(durationDays),
            { txn: stakeTxn, signer }
        ],
        sender: senseiAddress,
        signer,
        suggestedParams: sp,
    });

    // 3. DojoRegistry.list_agent call
    const registryAbi = new algosdk.ABIInterface({
        name: 'DojoRegistry',
        methods: [{
            name: 'list_agent',
            args: [
                { type: 'string', name: 'agent_id' },
                { type: 'uint64', name: 'expiry' }
            ],
            returns: { type: 'bool' }
        }]
    });

    const expiry = Math.floor(Date.now() / 1000) + (durationDays * 86400);

    atc.addMethodCall({
        appID: BigInt(dojoRegistryAppId),
        method: registryAbi.getMethodByName('list_agent'),
        methodArgs: [
            agentAddress,
            BigInt(expiry)
        ],
        sender: senseiAddress,
        signer,
        suggestedParams: sp,
    });

    return atc;
}
