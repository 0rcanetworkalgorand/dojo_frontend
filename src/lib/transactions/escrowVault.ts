import algosdk from 'algosdk';

export interface LockBountyParams {
    algodClient: algosdk.Algodv2;
    escrowAppId: number;
    usdcAsaId: number;
    clientAddress: string;
    workerAddress: string;
    taskId: string;
    bountyAmountAlgo: bigint;
    collateralAmountAlgo: bigint;
}

/**
 * Builds an atomic transaction group to lock a bounty in the EscrowVault.
 * 1. Asset Transfer (USDC) from Client to EscrowVault.
 * 2. Application Call (lock_bounty) to EscrowVault.
 */
export async function buildLockBountyAtomicGroup(params: LockBountyParams) {
    const {
        algodClient,
        escrowAppId,
        clientAddress,
        workerAddress,
        taskId,
        bountyAmountAlgo,
        collateralAmountAlgo
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();

    const appAddr = algosdk.getApplicationAddress(escrowAppId);

    // 1. Payment Transfer of Bounty
    const bountyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: clientAddress,
        receiver: appAddr,
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
                    { type: 'uint64', name: 'bounty_amount' },
                    { type: 'uint64', name: 'collateral_amount' },
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
            bountyAmountAlgo,
            collateralAmountAlgo,
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
}) {
    const { algodClient, escrowAppId, adminAddress, taskId } = params;
    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();

    const abi = new algosdk.ABIInterface({
        name: 'EscrowVault',
        methods: [
            {
                name: 'release_payment',
                args: [{ type: 'string', name: 'task_id' }],
                returns: { type: 'bool' }
            }
        ]
    });

    atc.addMethodCall({
        appID: BigInt(escrowAppId),
        method: abi.getMethodByName('release_payment'),
        methodArgs: [taskId],
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
 * 1. Asset Transfer (USDC) from Client to EscrowVault.
 * 2. Application Call (lock_bounty) to EscrowVault.
 */
export async function buildCreateTaskGroup(params: {
    algodClient: algosdk.Algodv2;
    escrowVaultAppId: number;
    clientAddress: string;
    workerAddress: string;
    taskId: string;
    bountyAmountAlgo: bigint;
    collateralAmountAlgo: bigint;
    signer: algosdk.TransactionSigner;
}): Promise<algosdk.AtomicTransactionComposer> {
    const {
        algodClient,
        escrowVaultAppId,
        clientAddress,
        workerAddress,
        taskId,
        bountyAmountAlgo,
        collateralAmountAlgo,
        signer
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    const appAddr = algosdk.getApplicationAddress(escrowVaultAppId);

    // 1. Payment Transfer of Bounty
    const bountyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: clientAddress,
        receiver: appAddr,
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
                    { type: 'uint64', name: 'bounty_amount' },
                    { type: 'uint64', name: 'collateral_amount' },
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
            bountyAmountAlgo,
            collateralAmountAlgo,
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
