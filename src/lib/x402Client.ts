import algosdk from 'algosdk';

let x402Initialized = false;
let fetchWithPayment: typeof globalThis.fetch | null = null;

export async function initX402Client(signer: {
    signTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
    address: string;
}): Promise<void> {
    if (x402Initialized) return;

    try {
        const { wrapFetchWithPayment, x402Client } = await import('@x402-avm/fetch');
        const avm = await import('@x402-avm/avm');
        
        const client = new x402Client();
        
        // Create a custom signer that wraps the wallet's signTransactions
        const avmSigner = {
            address: signer.address,
            signTransactions: async (unsignedTxns: Uint8Array[], indexesToSign: number[]) => {
                const signed = await signer.signTransactions(unsignedTxns);
                const result: (Uint8Array | null)[] = [];
                for (let i = 0; i < unsignedTxns.length; i++) {
                    if (indexesToSign.includes(i)) {
                        result.push(signed[i]);
                    } else {
                        result.push(null);
                    }
                }
                return result;
            }
        };

        // Register Algorand scheme
        const ExactAvmScheme = (avm as any).ExactAvmScheme;
        client.register(avm.ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(avmSigner));

        fetchWithPayment = wrapFetchWithPayment(fetch, client);
        x402Initialized = true;

        console.log('[X402 Frontend] Client initialized');
    } catch (error) {
        console.error('[X402 Frontend] Failed to initialize:', error);
    }
}

export function getFetchWithPayment(): typeof globalThis.fetch | null {
    return fetchWithPayment;
}

export function isX402Ready(): boolean {
    return x402Initialized && fetchWithPayment !== null;
}

export const X402_CONFIG = {
    network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    usdcAssetId: 10458941,
};