import {
  AES,
  CBC,
  CFB,
  CTR,
  CipherParams,
  DES,
  ECB,
  Hex,
  HmacMD5,
  HmacSHA1,
  HmacSHA256,
  HmacSHA512,
  MD5,
  NoPadding,
  OFB,
  Pkcs7,
  SHA1,
  SHA256,
  SHA512,
  TripleDES,
  WordArray,
  ZeroPadding,
} from "crypto-es";
import { sm2, sm3, sm4 } from "sm-crypto";

export type BinaryEncoding = "text" | "hex" | "base64";
export type SymmetricAlgorithm = "aes" | "des" | "3des" | "sm4";
export type CipherMode = "ecb" | "cbc" | "ctr" | "cfb" | "ofb" | "gcm";
export type CipherPadding = "pkcs7" | "zero" | "none";

export interface SymmetricRequest {
  algorithm: SymmetricAlgorithm;
  operation: "encrypt" | "decrypt";
  mode: CipherMode;
  padding: CipherPadding;
  input: string;
  inputEncoding: BinaryEncoding;
  outputEncoding: BinaryEncoding;
  keyHex: string;
  ivHex?: string;
  aadHex?: string;
}

const cleanHex = (value: string, label: string) => {
  const normalized = value.replace(/(?:0x|[\s,:;_-])/gi, "");
  if (!normalized || normalized.length % 2 || !/^[\da-f]+$/i.test(normalized))
    throw new Error(`${label}必须是完整的十六进制字节`);
  return normalized.toLowerCase();
};

export const hexToBytes = (value: string, label = "HEX 输入") => {
  const normalized = cleanHex(value, label);
  return Uint8Array.from(
    { length: normalized.length / 2 },
    (_, index) => Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
  );
};

export const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  try {
    const binary = atob(value.replace(/\s/g, ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Base64 输入无效");
  }
};

export const decodeBinary = (value: string, encoding: BinaryEncoding) =>
  encoding === "text"
    ? new TextEncoder().encode(value)
    : encoding === "hex"
      ? hexToBytes(value)
      : base64ToBytes(value);

export const encodeBinary = (bytes: Uint8Array, encoding: BinaryEncoding) =>
  encoding === "text"
    ? new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    : encoding === "hex"
      ? bytesToHex(bytes)
      : bytesToBase64(bytes);

export interface BinaryComparison {
  matches: boolean;
  mismatchOffset: number | null;
  actualLength: number;
  expectedLength: number;
  actualByte: number | null;
  expectedByte: number | null;
}

export const compareEncodedValues = (
  actual: string,
  expected: string,
  encoding: BinaryEncoding,
): BinaryComparison => {
  const actualBytes = decodeBinary(actual, encoding);
  const expectedBytes = decodeBinary(expected, encoding);
  const commonLength = Math.min(actualBytes.length, expectedBytes.length);
  let mismatchOffset: number | null = null;

  for (let index = 0; index < commonLength; index += 1) {
    if (actualBytes[index] !== expectedBytes[index]) {
      mismatchOffset = index;
      break;
    }
  }
  if (mismatchOffset === null && actualBytes.length !== expectedBytes.length)
    mismatchOffset = commonLength;

  return {
    matches: mismatchOffset === null,
    mismatchOffset,
    actualLength: actualBytes.length,
    expectedLength: expectedBytes.length,
    actualByte: mismatchOffset === null || mismatchOffset >= actualBytes.length ? null : actualBytes[mismatchOffset],
    expectedByte:
      mismatchOffset === null || mismatchOffset >= expectedBytes.length ? null : expectedBytes[mismatchOffset],
  };
};

const wordArray = (bytes: Uint8Array) => Hex.parse(bytesToHex(bytes));
const wordArrayBytes = (value: WordArray) => hexToBytes(value.toString(Hex));

const validateKey = (algorithm: SymmetricAlgorithm, key: Uint8Array) => {
  const expected =
    algorithm === "aes"
      ? [16, 24, 32]
      : algorithm === "des"
        ? [8]
        : algorithm === "3des"
          ? [16, 24]
          : [16];
  if (!expected.includes(key.length))
    throw new Error(`${algorithm.toUpperCase()} 密钥必须是 ${expected.map((size) => `${size}字节`).join("、")}`);
};

const modeValue = { ecb: ECB, cbc: CBC, ctr: CTR, cfb: CFB, ofb: OFB };
const paddingValue = { pkcs7: Pkcs7, zero: ZeroPadding, none: NoPadding };

async function runAesGcm(request: SymmetricRequest, input: Uint8Array, key: Uint8Array, iv: Uint8Array) {
  if (request.padding !== "none") throw new Error("AES-GCM不使用分组填充，请选择无填充");
  if (iv.length < 12 || iv.length > 16) throw new Error("AES-GCM Nonce建议使用12字节，允许12到16字节");
  const keyBuffer = Uint8Array.from(key).buffer;
  const inputBuffer = Uint8Array.from(input).buffer;
  const ivBuffer = Uint8Array.from(iv).buffer;
  const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, "AES-GCM", false, [request.operation]);
  const additionalData = request.aadHex?.trim() ? hexToBytes(request.aadHex, "AAD") : undefined;
  const algorithm = { name: "AES-GCM", iv: ivBuffer, ...(additionalData ? { additionalData: Uint8Array.from(additionalData).buffer } : {}), tagLength: 128 };
  try {
    const result = request.operation === "encrypt"
      ? await crypto.subtle.encrypt(algorithm, cryptoKey, inputBuffer)
      : await crypto.subtle.decrypt(algorithm, cryptoKey, inputBuffer);
    return new Uint8Array(result);
  } catch {
    throw new Error(request.operation === "decrypt" ? "AES-GCM解密或认证失败，请检查密钥、Nonce、AAD和认证标签" : "AES-GCM加密失败");
  }
}

export async function runSymmetricCipher(request: SymmetricRequest) {
  const input = decodeBinary(request.input, request.inputEncoding);
  if (input.length > 16 * 1024 * 1024) throw new Error("单次输入不得超过16 MiB");
  const key = hexToBytes(request.keyHex, "密钥");
  validateKey(request.algorithm, key);
  if (request.algorithm !== "aes" && request.mode === "gcm") throw new Error("只有AES支持GCM模式");
  if (request.algorithm === "sm4" && !["ecb", "cbc"].includes(request.mode)) throw new Error("SM4当前仅支持ECB和CBC模式");
  if (request.algorithm === "des" || request.algorithm === "3des") {
    if (!["ecb", "cbc", "cfb", "ofb"].includes(request.mode)) throw new Error("DES/3DES当前支持ECB、CBC、CFB和OFB模式");
  }
  const needsIv = request.mode !== "ecb";
  const iv = needsIv ? hexToBytes(request.ivHex ?? "", request.mode === "gcm" ? "Nonce" : "IV") : new Uint8Array();
  if (request.mode !== "gcm" && needsIv) {
    const expected = request.algorithm === "des" || request.algorithm === "3des" ? 8 : 16;
    if (iv.length !== expected) throw new Error(`IV必须是${expected}字节`);
  }
  if (request.algorithm === "aes" && request.mode === "gcm") {
    const output = await runAesGcm(request, input, key, iv);
    return { bytes: output, output: encodeBinary(output, request.outputEncoding) };
  }
  const blockSize = request.algorithm === "des" || request.algorithm === "3des" ? 8 : 16;
  if (request.padding === "none" && !["ctr", "cfb", "ofb"].includes(request.mode) && input.length % blockSize)
    throw new Error(`无填充模式要求输入长度是${blockSize}字节的整数倍`);
  if (request.algorithm === "sm4") {
    const options = {
      padding: request.padding === "pkcs7" ? "pkcs#7" as const : "none" as const,
      ...(request.mode === "cbc" ? { mode: "cbc" as const, iv: Array.from(iv) } : {}),
      output: "array" as const,
    };
    if (request.padding === "zero") throw new Error("SM4当前不支持零填充，请使用PKCS#7或无填充");
    const result = request.operation === "encrypt"
      ? sm4.encrypt(Array.from(input), Array.from(key), options)
      : sm4.decrypt(Array.from(input), Array.from(key), options);
    const bytes = Uint8Array.from(result as number[]);
    return { bytes, output: encodeBinary(bytes, request.outputEncoding) };
  }
  const cipher = request.algorithm === "aes" ? AES : request.algorithm === "des" ? DES : TripleDES;
  const configuration = {
    mode: modeValue[request.mode as keyof typeof modeValue],
    padding: paddingValue[request.padding],
    ...(needsIv ? { iv: wordArray(iv) } : {}),
  };
  const result = request.operation === "encrypt"
    ? cipher.encrypt(wordArray(input), wordArray(key), configuration).ciphertext
    : cipher.decrypt(CipherParams.create({ ciphertext: wordArray(input) }), wordArray(key), configuration);
  if (!result) throw new Error("解密失败，请检查算法参数和填充方式");
  const bytes = wordArrayBytes(result);
  return { bytes, output: encodeBinary(bytes, request.outputEncoding) };
}

export type DigestAlgorithm = "md5" | "sha1" | "sha256" | "sha512" | "sm3";
export function calculateDigest(algorithm: DigestAlgorithm, input: string, encoding: BinaryEncoding) {
  const bytes = decodeBinary(input, encoding);
  if (bytes.length > 16 * 1024 * 1024) throw new Error("单次输入不得超过16 MiB");
  if (algorithm === "sm3") return sm3(Array.from(bytes)).toUpperCase();
  const value = wordArray(bytes);
  const digest = algorithm === "md5" ? MD5(value) : algorithm === "sha1" ? SHA1(value) : algorithm === "sha256" ? SHA256(value) : SHA512(value);
  return digest.toString(Hex).toUpperCase();
}

export function calculateHmac(algorithm: DigestAlgorithm, input: string, encoding: BinaryEncoding, keyHex: string) {
  const bytes = decodeBinary(input, encoding);
  const key = hexToBytes(keyHex, "HMAC密钥");
  if (bytes.length > 16 * 1024 * 1024) throw new Error("单次输入不得超过16 MiB");
  if (algorithm === "sm3") return sm3(Array.from(bytes), { mode: "hmac", key: Array.from(key) }).toUpperCase();
  const value = wordArray(bytes), keyValue = wordArray(key);
  const digest = algorithm === "md5" ? HmacMD5(value, keyValue) : algorithm === "sha1" ? HmacSHA1(value, keyValue) : algorithm === "sha256" ? HmacSHA256(value, keyValue) : HmacSHA512(value, keyValue);
  return digest.toString(Hex).toUpperCase();
}

export const generateSm2KeyPair = () => sm2.generateKeyPairHex();

export function runSm2(options: {
  operation: "encrypt" | "decrypt" | "sign" | "verify";
  input: string;
  inputEncoding: BinaryEncoding;
  privateKey: string;
  publicKey: string;
  signature: string;
  cipherMode: 0 | 1;
  der: boolean;
  userId?: string;
}) {
  const bytes = decodeBinary(options.input, options.inputEncoding);
  if (bytes.length > 1024 * 1024) throw new Error("SM2单次输入不得超过1 MiB");
  if (options.operation === "encrypt") return sm2.doEncrypt(Array.from(bytes), options.publicKey.trim(), options.cipherMode).toUpperCase();
  if (options.operation === "decrypt") {
    const ciphertext = options.inputEncoding === "base64" ? bytesToHex(bytes) : cleanHex(options.input, "SM2密文");
    const result = sm2.doDecrypt(ciphertext, options.privateKey.trim(), options.cipherMode, { output: "array" });
    if (!Array.isArray(result) || !result.length) throw new Error("SM2解密失败，请检查密钥和密文格式");
    return encodeBinary(Uint8Array.from(result), options.inputEncoding === "hex" ? "hex" : "text");
  }
  if (options.operation === "sign") return sm2.doSignature(Array.from(bytes), options.privateKey.trim(), { der: options.der, hash: true, publicKey: options.publicKey.trim() || undefined, userId: options.userId }).toUpperCase();
  return sm2.doVerifySignature(Array.from(bytes), cleanHex(options.signature, "签名"), options.publicKey.trim(), { der: options.der, hash: true, userId: options.userId }) ? "验签通过" : "验签失败";
}

export async function runCryptoSelfTests() {
  const cases: Array<{ name: string; passed: boolean; expected: string; actual: string }> = [];
  const add = (name: string, actual: string, expected: string) => cases.push({ name, actual: actual.toUpperCase(), expected: expected.toUpperCase(), passed: actual.toUpperCase() === expected.toUpperCase() });
  add("AES-128 ECB", (await runSymmetricCipher({ algorithm: "aes", operation: "encrypt", mode: "ecb", padding: "none", input: "00112233445566778899AABBCCDDEEFF", inputEncoding: "hex", outputEncoding: "hex", keyHex: "000102030405060708090A0B0C0D0E0F" })).output, "69C4E0D86A7B0430D8CDB78070B4C55A");
  add("DES ECB", (await runSymmetricCipher({ algorithm: "des", operation: "encrypt", mode: "ecb", padding: "none", input: "0123456789ABCDEF", inputEncoding: "hex", outputEncoding: "hex", keyHex: "133457799BBCDFF1" })).output, "85E813540F0AB405");
  add("3DES ECB", (await runSymmetricCipher({ algorithm: "3des", operation: "encrypt", mode: "ecb", padding: "none", input: "5468652071756663", inputEncoding: "hex", outputEncoding: "hex", keyHex: "0123456789ABCDEF23456789ABCDEF01456789ABCDEF0123" })).output, "A826FD8CE53B855F");
  add("SM3", calculateDigest("sm3", "abc", "text"), "66C7F0F462EEEDD9D1F2D46BDC10E4E24167C4875CF2F7A2297DA02B8F4BA8E0");
  add("SM4 ECB", (await runSymmetricCipher({ algorithm: "sm4", operation: "encrypt", mode: "ecb", padding: "none", input: "0123456789ABCDEFFEDCBA9876543210", inputEncoding: "hex", outputEncoding: "hex", keyHex: "0123456789ABCDEFFEDCBA9876543210" })).output, "681EDF34D206965E86B3E94F536E4246");
  return cases;
}
