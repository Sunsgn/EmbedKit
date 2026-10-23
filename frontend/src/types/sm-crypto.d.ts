declare module "sm-crypto" {
  export const sm2: {
    generateKeyPairHex(): { privateKey: string; publicKey: string };
    getPublicKeyFromPrivateKey(privateKey: string): string;
    doEncrypt(data: string | number[], publicKey: string, cipherMode?: 0 | 1): string;
    doDecrypt(data: string, privateKey: string, cipherMode?: 0 | 1, options?: { output?: "string" | "array" }): string | number[];
    doSignature(data: string | number[], privateKey: string, options?: { der?: boolean; hash?: boolean; publicKey?: string; userId?: string }): string;
    doVerifySignature(data: string | number[], signature: string, publicKey: string, options?: { der?: boolean; hash?: boolean; userId?: string }): boolean;
  };
  export function sm3(data: string | number[], options?: { mode?: "hmac"; key?: string | number[] }): string;
  export const sm4: {
    encrypt(data: string | number[], key: string | number[], options?: { padding?: "none" | "pkcs#5" | "pkcs#7"; mode?: "cbc"; iv?: string | number[]; output?: "string" | "array" }): string | number[];
    decrypt(data: string | number[], key: string | number[], options?: { padding?: "none" | "pkcs#5" | "pkcs#7"; mode?: "cbc"; iv?: string | number[]; output?: "string" | "array" }): string | number[];
  };
}
