import algosdk from 'algosdk';

export interface LockBountyParams {
    algodClient: algosdk.Algodv2;
    escrowAppId: number;
    clientAddress: string;
    workerAddress: string;
    senseiAddress: string;
    taskId: string;
    bountyAmountAlgo: bigint;
}

/**
 * Builds an atomic transaction group to lock a bounty in the EscrowVault.
 * 1. Payment (ALGO) from Client to EscrowVault.
 * 2. Application Call (lock_bounty) to EscrowVault.
 */
export async function buildLockBountyAtomicGroup(params: LockBountyParams) {
    const {
        algodClient,
        escrowAppId,
        clientAddress,
        workerAddress,
        senseiAddress,
        taskId,
        bountyAmountAlgo,
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();

    const appAddr = algosdk.getApplicationAddress(escrowAppId);

    // 1. Payment Transfer of Bounty
    const bountyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: clientAddress,
        receiver: appAddr.toString(),
        amount: bountyAmountAlgo,
        suggestedParams: sp,
    });

    // 2. lock_bounty call
    const abi = new algosdk.ABIInterface({
        name: 'EscrowVault',
        methods: [
            {
                name: 'lock_bounty',
                args: [
                    { type: 'string', name: 'task_id' },
                    { type: 'address', name: 'client' },
                    { type: 'address', name: 'worker' },
                    { type: 'address', name: 'sensei' },
                    { type: 'uint64', name: 'bounty_amount' },
                    { type: 'pay', name: 'bounty_txn' }
                ],
                returns: { type: 'bool' }
            }
        ]
    });

    atc.addMethodCall({
        appID: BigInt(escrowAppId),
        method: abi.getMethodByName('lock_bounty'),
        methodArgs: [
            taskId,
            clientAddress,
            workerAddress,
            senseiAddress,
            bountyAmountAlgo,
            { txn: bountyTxn, signer: algosdk.makeEmptyTransactionSigner() }
        ],
        sender: clientAddress,
        signer: algosdk.makeEmptyTransactionSigner(),
        suggestedParams: sp,
        boxes: [
            { appIndex: escrowAppId, name: new Uint8Array(Buffer.from(taskId)) }
        ]
    });

    return atc;
}

/**
 * Builds an atomic transaction group to release payment from the EscrowVault.
 * Only callable by Admin (usually via the backend, but providing here for frontend admin tools).
 */
export async function buildReleasePaymentTransaction(params: {
    algodClient: algosdk.Algodv2;
    escrowAppId: number;
    adminAddress: string;
    taskId: string;
    treasuryAddress: string;
}) {
    const { algodClient, escrowAppId, adminAddress, taskId, treasuryAddress } = params;
    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();

    const abi = new algosdk.ABIInterface({
        name: 'EscrowVault',
        methods: [
            {
                name: 'release_payment',
                args: [
                    { type: 'string', name: 'task_id' },
                    { type: 'address', name: 'treasury' }
                ],
                returns: { type: 'bool' }
            }
        ]
    });

    atc.addMethodCall({
        appID: BigInt(escrowAppId),
        method: abi.getMethodByName('release_payment'),
        methodArgs: [taskId, treasuryAddress],
        sender: adminAddress,
        signer: algosdk.makeEmptyTransactionSigner(),
        suggestedParams: sp,
        boxes: [
            { appIndex: escrowAppId, name: new Uint8Array(Buffer.from(taskId)) }
        ]
    });

    return atc;
}

/**
 * Builds an atomic transaction group to lock a bounty in the EscrowVault.
 * Used from the Hire page — client stakes ALGO for a task.
 * 
 * On success: 2% to platform treasury, 98% to sensei (developer).
 * On failure: 100% refunded to client (user).
 */
export async function buildCreateTaskGroup(params: {
    algodClient: algosdk.Algodv2;
    escrowVaultAppId: number;
    clientAddress: string;
    workerAddress: string;
    senseiAddress: string;
    taskId: string;
    bountyAmountAlgo: bigint;
    signer: algosdk.TransactionSigner;
}): Promise<algosdk.AtomicTransactionComposer> {
    const {
        algodClient,
        escrowVaultAppId,
        clientAddress,
        workerAddress,
        senseiAddress,
        taskId,
        bountyAmountAlgo,
        signer
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    const appAddr = algosdk.getApplicationAddress(escrowVaultAppId);

    // 1. Payment Transfer of Bounty
    const bountyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: clientAddress,
        receiver: appAddr.toString(),
        amount: bountyAmountAlgo,
        suggestedParams: sp,
    });

    // 2. lock_bounty call
    const abi = new algosdk.ABIInterface({
        name: 'EscrowVault',
        methods: [
            {
                name: 'lock_bounty',
                args: [
                    { type: 'string', name: 'task_id' },
                    { type: 'address', name: 'client' },
                    { type: 'address', name: 'worker' },
                    { type: 'address', name: 'sensei' },
                    { type: 'uint64', name: 'bounty_amount' },
                    { type: 'pay', name: 'bounty_txn' }
                ],
                returns: { type: 'bool' }
            }
        ]
    });

    atc.addMethodCall({
        appID: BigInt(escrowVaultAppId),
        method: abi.getMethodByName('lock_bounty'),
        methodArgs: [
            taskId,
            clientAddress,
            workerAddress,
            senseiAddress,
            bountyAmountAlgo,
            { txn: bountyTxn, signer }
        ],
        sender: clientAddress,
        signer,
        suggestedParams: sp,
        boxes: [
            { appIndex: escrowVaultAppId, name: new Uint8Array(Buffer.from(taskId)) }
        ]
    });

    return atc;
}
