const STORAGE_KEYS = {
    PRIVATE_KEY: 'dojo_encryption_private_key',
    PUBLIC_KEY: 'dojo_encryption_public_key'
};

export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function generateKeyPair(): Promise<KeyPair> {
    if (!window.crypto?.subtle) {
        console.error('[Crypto] window.crypto.subtle not available');
        throw new Error('Crypto API not available - requires secure context (HTTPS or localhost)');
    }
    
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
        );

        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

        return {
            publicKey: arrayBufferToBase64(publicKeyBuffer),
            privateKey: arrayBufferToBase64(privateKeyBuffer)
        };
    } catch (error) {
        console.error('[Crypto] generateKeyPair failed:', error);
        throw error;
    }
}

export function storeKeyPair(keyPair: KeyPair): void {
    if (typeof window !== 'undefined') {
        console.log('[Crypto] Storing keys, priv length:', keyPair.privateKey.length, 'pub length:', keyPair.publicKey.length);
        try {
            localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, keyPair.privateKey);
            localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, keyPair.publicKey);
            console.log('[Crypto] Keys stored successfully');
            // Verify
            const storedPriv = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
            console.log('[Crypto] Verified private key in storage:', !!storedPriv);
        } catch (err) {
            console.error('[Crypto] Failed to store keys:', err);
        }
    }
}

export function getStoredKeyPair(): KeyPair | null {
    if (typeof window === 'undefined') return null;
    
    const privateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
    const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    
    if (privateKey && publicKey) {
        return { privateKey, publicKey };
    }
    return null;
}

export function getStoredPrivateKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
}

export function getStoredPublicKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
}

export async function decryptWithPrivateKey(encryptedBase64: string, privateKeyBase64: string): Promise<string> {
    try {
        const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);
        const encryptedArray = new Uint8Array(encryptedBuffer);
        
        // Hybrid decryption:
        // Format: IV (16 bytes) + AuthTag (16 bytes) + EncryptedAESKey (256 bytes for RSA-2048) + EncryptedData
        const IV_SIZE = 16;
        const AUTH_TAG_SIZE = 16;
        const RSA_KEY_SIZE = 256;
        
        const iv = encryptedArray.slice(0, IV_SIZE);
        const authTag = encryptedArray.slice(IV_SIZE, IV_SIZE + AUTH_TAG_SIZE);
        const encryptedAesKey = encryptedArray.slice(IV_SIZE + AUTH_TAG_SIZE, IV_SIZE + AUTH_TAG_SIZE + RSA_KEY_SIZE);
        const encryptedData = encryptedArray.slice(IV_SIZE + AUTH_TAG_SIZE + RSA_KEY_SIZE);
        
        // 1. Decrypt AES key with RSA private key
        const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
        const privateKey = await window.crypto.subtle.importKey(
            'pkcs8',
            privateKeyBuffer,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['decrypt']
        );
        
        const aesKeyBuffer = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privateKey,
            encryptedAesKey
        );
        
        // 2. Import AES key
        const aesKey = await window.crypto.subtle.importKey(
            'raw',
            aesKeyBuffer,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        // 3. Decrypt data with AES - Web Crypto needs auth tag appended to ciphertext
        // Combine auth tag with encrypted data for GCM
        const combinedCiphertext = new Uint8Array(encryptedData.length + authTag.length);
        combinedCiphertext.set(encryptedData, 0);
        combinedCiphertext.set(authTag, encryptedData.length);
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            combinedCiphertext
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (error) {
        console.error('[Crypto] Decryption failed:', error);
        throw new Error('Failed to decrypt output: ' + (error as Error).message);
    }
}

export async function ensureKeyPair(): Promise<KeyPair> {
    console.log('[Crypto] ensureKeyPair called');
    let keyPair = getStoredKeyPair();
    
    if (!keyPair) {
        console.log('[Crypto] No keypair in storage, generating new one...');
        try {
            keyPair = await generateKeyPair();
            storeKeyPair(keyPair);
            console.log('[Crypto] Keypair generated and stored in localStorage');
            console.log('[Crypto] Private key stored:', !!keyPair.privateKey);
            console.log('[Crypto] Public key stored:', !!keyPair.publicKey);
        } catch (err) {
            console.error('[Crypto] Failed to generate keypair:', err);
            throw err;
        }
    } else {
        console.log('[Crypto] Found existing keypair in storage');
    }
    
    return keyPair;
}

export function clearKeys(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
        localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
    }
}