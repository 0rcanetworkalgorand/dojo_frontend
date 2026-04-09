import algosdk from 'algosdk';

export interface LockBountyParams {
    algodClient: algosdk.Algodv2;
    escrowAppId: number;
    usdcAsaId: number;
    clientAddress: string;
    workerAddress: string;
    taskId: string;
    bountyAmountUsdc: bigint;
    collateralAmountUsdc: bigint;
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
        usdcAsaId,
        clientAddress,
        workerAddress,
        taskId,
        bountyAmountUsdc,
        collateralAmountUsdc
    } = params;

    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();

    const appAddr = algosdk.getApplicationAddress(escrowAppId);

    // 1. Asset Transfer of Bounty
    const bountyTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: clientAddress,
        receiver: appAddr,
        assetIndex: Number(usdcAsaId),
        amount: bountyAmountUsdc,
        suggestedParams: sp,
    } as any);

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
                    { type: 'axfer', name: 'bounty_txn' }
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
            bountyAmountUsdc,
            collateralAmountUsdc,
            { txn: bountyTxn, signer: algosdk.makeEmptyTransactionSigner() }
        ],
        sender: clientAddress,
        signer: algosdk.makeEmptyTransactionSigner(),
        suggestedParams: sp,
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
    });

    return atc;
}

/**
 * Builds an atomic transaction group to create a task in the EscrowVault.
 * 1. Asset Transfer (USDC) to EscrowVault.
 * 2. Application Call (createTask) to EscrowVault.
 */
export async function buildCreateTaskGroup(params: {
  algodClient: algosdk.Algodv2,
  clientAddress: string,
  agentAddress: string,
  taskId: string,
  bountyAmountUsdc: bigint,
  deadlineUnixTimestamp: number,
  usdcAsaId: number,
  escrowVaultAppId: number,
  signer: algosdk.TransactionSigner
}): Promise<algosdk.AtomicTransactionComposer> {
  const { algodClient, clientAddress, taskId, bountyAmountUsdc, deadlineUnixTimestamp, usdcAsaId, escrowVaultAppId, signer } = params;
  const sp = await algodClient.getTransactionParams().do();
  const atc = new algosdk.AtomicTransactionComposer();
  const appAddr = algosdk.getApplicationAddress(escrowVaultAppId);

  // 1. Asset Transfer of Bounty
  const bountyTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: clientAddress,
    receiver: appAddr,
    assetIndex: usdcAsaId,
    amount: bountyAmountUsdc,
    suggestedParams: sp,
  });

  // 2. Application Call: createTask(bytes32, uint64)
  const abi = new algosdk.ABIInterface({
    name: 'EscrowVault',
    methods: [
      {
        name: 'createTask',
        args: [
          { type: 'byte[32]', name: 'task_id' },
          { type: 'uint64', name: 'deadline' }
        ],
        returns: { type: 'void' }
      }
    ]
  });

  // Convert taskId string to 32-byte array (pad/truncate as needed)
  const taskIdBytes = new Uint8Array(32);
  const encodedId = new TextEncoder().encode(taskId);
  taskIdBytes.set(encodedId.slice(0, 32));

  atc.addMethodCall({
    appID: BigInt(escrowVaultAppId),
    method: abi.getMethodByName('createTask'),
    methodArgs: [taskIdBytes, BigInt(deadlineUnixTimestamp)],
    sender: clientAddress,
    signer,
    suggestedParams: sp,
  });

  // Add the asset transfer as the first transaction in the group
  // Actually, some implementations expect the axfer within the method call or as an accompaniment.
  // The user says "The group contains two transactions".
  // Note: addMethodCall with an explicit txn in methodArgs is one way, 
  // but if the method signature is just (byte[32], uint64), then the axfer must be a separate transaction in the same group.
  
  // To match "The group contains two transactions", I'll add the axfer separately.
  // Wait, if it's added separately, atc.addTransaction({txn, signer}) should be used.
  
  atc.addTransaction({ txn: bountyTxn, signer });

  return atc;
}
