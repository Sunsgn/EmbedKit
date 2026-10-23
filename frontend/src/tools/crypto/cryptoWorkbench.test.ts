import { describe, expect, it } from "vitest";
import { calculateDigest, calculateHmac, generateSm2KeyPair, runCryptoSelfTests, runSm2, runSymmetricCipher } from "./cryptoWorkbench";

describe("crypto workbench domain", () => {
  it("passes published known-answer vectors", async () => {
    const results = await runCryptoSelfTests();
    expect(results).toHaveLength(5);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("round-trips AES-CBC binary data and rejects invalid keys", async () => {
    const common = { algorithm: "aes" as const, mode: "cbc" as const, padding: "pkcs7" as const, inputEncoding: "hex" as const, outputEncoding: "hex" as const, keyHex: "00112233445566778899AABBCCDDEEFF", ivHex: "000102030405060708090A0B0C0D0E0F" };
    const encrypted = await runSymmetricCipher({ ...common, operation: "encrypt", input: "00FF1020" });
    const decrypted = await runSymmetricCipher({ ...common, operation: "decrypt", input: encrypted.output });
    expect(decrypted.output).toBe("00FF1020");
    await expect(runSymmetricCipher({ ...common, operation: "encrypt", input: "00", keyHex: "1234" })).rejects.toThrow("AES 密钥必须");
  });

  it("authenticates AES-GCM data and rejects a changed tag", async () => {
    const common = { algorithm: "aes" as const, mode: "gcm" as const, padding: "none" as const, inputEncoding: "hex" as const, outputEncoding: "hex" as const, keyHex: "000102030405060708090A0B0C0D0E0F", ivHex: "00112233445566778899AABB", aadHex: "A0A1A2A3" };
    const encrypted = await runSymmetricCipher({ ...common, operation: "encrypt", input: "01020304" });
    expect((await runSymmetricCipher({ ...common, operation: "decrypt", input: encrypted.output })).output).toBe("01020304");
    const changed = `${encrypted.output.slice(0, -2)}${encrypted.output.endsWith("00") ? "01" : "00"}`;
    await expect(runSymmetricCipher({ ...common, operation: "decrypt", input: changed })).rejects.toThrow("认证失败");
  });

  it("calculates hashes from text and supports SM2 encrypt/decrypt", () => {
    expect(calculateDigest("sha256", "abc", "text")).toBe("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD");
    expect(calculateHmac("sha256", "Hi There", "text", "0B".repeat(20))).toBe("B0344C61D8DB38535CA8AFCEAF0BF12B881DC200C9833DA726E9376C2E32CFF7");
    const { privateKey, publicKey } = generateSm2KeyPair();
    const encrypted = runSm2({ operation: "encrypt", input: "设备联调", inputEncoding: "text", privateKey, publicKey, signature: "", cipherMode: 1, der: false });
    expect(runSm2({ operation: "decrypt", input: encrypted, inputEncoding: "text", privateKey, publicKey, signature: "", cipherMode: 1, der: false })).toBe("设备联调");
    const signature = runSm2({ operation: "sign", input: "设备联调", inputEncoding: "text", privateKey, publicKey, signature: "", cipherMode: 1, der: false, userId: "1234567812345678" });
    expect(runSm2({ operation: "verify", input: "设备联调", inputEncoding: "text", privateKey: "", publicKey, signature, cipherMode: 1, der: false, userId: "1234567812345678" })).toBe("验签通过");
  });
});
