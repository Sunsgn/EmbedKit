import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import {
  calculateDigest,
  calculateHmac,
  compareEncodedValues,
  generateSm2KeyPair,
  runCryptoSelfTests,
  runSm2,
  runSymmetricCipher,
  type BinaryEncoding,
  type CipherMode,
  type CipherPadding,
  type DigestAlgorithm,
  type SymmetricAlgorithm,
} from "./cryptoWorkbench";

type Workspace = "symmetric" | "digest" | "sm2";
const encodingNames: Record<BinaryEncoding, string> = { text: "UTF-8文本", hex: "HEX", base64: "Base64" };

function EncodingSelect({ value, onChange, label }: { value: BinaryEncoding; onChange: (value: BinaryEncoding) => void; label: string }) {
  return <label className="text-[11px] text-gray-500">{label}<select value={value} onChange={event => onChange(event.target.value as BinaryEncoding)} className="field mt-1">{Object.entries(encodingNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

export default function CryptoTool() {
  const [workspace, setWorkspace] = useState<Workspace>("symmetric");
  const [algorithm, setAlgorithm] = useState<SymmetricAlgorithm>("aes"), [operation, setOperation] = useState<"encrypt" | "decrypt">("encrypt"), [mode, setMode] = useState<CipherMode>("cbc"), [padding, setPadding] = useState<CipherPadding>("pkcs7");
  const [input, setInput] = useState("EmbedKit"), [inputEncoding, setInputEncoding] = useState<BinaryEncoding>("text"), [outputEncoding, setOutputEncoding] = useState<BinaryEncoding>("hex");
  const [keyHex, setKeyHex] = useState("00112233445566778899AABBCCDDEEFF"), [ivHex, setIvHex] = useState("000102030405060708090A0B0C0D0E0F"), [aadHex, setAadHex] = useState("");
  const [useZeroIv, setUseZeroIv] = useState(false);
  const [output, setOutput] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [expectedOutput, setExpectedOutput] = useState("");
  const [comparison, setComparison] = useState<ReturnType<typeof compareEncodedValues> | null>(null);
  const [showSecrets, setShowSecrets] = useState(true);
  const [digestAlgorithm, setDigestAlgorithm] = useState<DigestAlgorithm>("sha256"), [digestInput, setDigestInput] = useState("abc"), [digestEncoding, setDigestEncoding] = useState<BinaryEncoding>("text"), [digestResult, setDigestResult] = useState(""), [hmac, setHmac] = useState(false), [hmacKey, setHmacKey] = useState("");
  const [privateKey, setPrivateKey] = useState(""), [publicKey, setPublicKey] = useState(""), [sm2Operation, setSm2Operation] = useState<"encrypt" | "decrypt" | "sign" | "verify">("encrypt"), [sm2Input, setSm2Input] = useState("EmbedKit"), [sm2Encoding, setSm2Encoding] = useState<BinaryEncoding>("text"), [signature, setSignature] = useState(""), [cipherMode, setCipherMode] = useState<0 | 1>(1), [der, setDer] = useState(false), [userId, setUserId] = useState("1234567812345678"), [sm2Output, setSm2Output] = useState(""), [sm2Error, setSm2Error] = useState("");
  const [selfTests, setSelfTests] = useState<Array<{ name: string; passed: boolean }>>([]);

  useEffect(() => { void runCryptoSelfTests().then(setSelfTests).catch(() => setSelfTests([{ name: "密码算法自检执行失败", passed: false }])); }, []);
  const selectAlgorithm = (selected: SymmetricAlgorithm) => {
    setAlgorithm(selected);
    setUseZeroIv(false);
    if (selected === "rc4") { setKeyHex("4B6579"); setMode("stream"); setPadding("none"); }
    else if (selected === "des") { setKeyHex("133457799BBCDFF1"); setIvHex("0102030405060708"); }
    else if (selected === "3des") { setKeyHex("0123456789ABCDEFFEDCBA987654321089ABCDEF01234567"); setIvHex("0102030405060708"); }
    else { setKeyHex("00112233445566778899AABBCCDDEEFF"); setIvHex("000102030405060708090A0B0C0D0E0F"); }
    if (selected !== "rc4" && (mode === "stream" || (selected !== "aes" && mode === "gcm"))) setMode("cbc");
  };
  const executeSymmetric = async () => {
    setBusy(true); setError(""); setOutput(""); setComparison(null);
    try {
      const zeroIvBytes = algorithm === "des" || algorithm === "3des" ? 8 : 16;
      const effectiveIvHex = useZeroIv && mode !== "ecb" && mode !== "gcm" ? "00".repeat(zeroIvBytes) : ivHex;
      const result = await runSymmetricCipher({ algorithm, operation, mode, padding, input, inputEncoding, outputEncoding, keyHex, ivHex: effectiveIvHex, aadHex });
      setOutput(result.output);
      setComparison(expectedOutput.trim() ? compareEncodedValues(result.output, expectedOutput, outputEncoding) : null);
    }
    catch (reason) { setComparison(null); setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const executeDigest = () => { try { setError(""); setDigestResult(hmac ? calculateHmac(digestAlgorithm, digestInput, digestEncoding, hmacKey) : calculateDigest(digestAlgorithm, digestInput, digestEncoding)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const createKeys = () => { const pair = generateSm2KeyPair(); setPrivateKey(pair.privateKey.toUpperCase()); setPublicKey(pair.publicKey.toUpperCase()); setSm2Error(""); };
  const executeSm2 = () => { try { setSm2Error(""); setSm2Output(runSm2({ operation: sm2Operation, input: sm2Input, inputEncoding: sm2Encoding, privateKey, publicKey, signature, cipherMode, der, userId })); } catch (reason) { setSm2Error(reason instanceof Error ? reason.message : String(reason)); } };
  const clearSensitive = () => { setKeyHex(""); setIvHex(""); setAadHex(""); setInput(""); setOutput(""); setExpectedOutput(""); setComparison(null); setDigestInput(""); setDigestResult(""); setHmacKey(""); setPrivateKey(""); setPublicKey(""); setSignature(""); setSm2Input(""); setSm2Output(""); setError(""); setSm2Error(""); };

  return <div className="space-y-4">
    <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#30363d] bg-[#111820] p-3">
      {([['symmetric', 'AES / DES / 3DES / SM4'], ['digest', '摘要与SM3'], ['sm2', 'SM2加密与签名']] as const).map(([id, label]) => <button key={id} onClick={() => setWorkspace(id)} className={`rounded px-3 py-1.5 text-xs ${workspace === id ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0d1117] text-gray-500'}`}>{label}</button>)}
      <button onClick={() => setShowSecrets(value => !value)} aria-pressed={showSecrets} className="ml-auto flex items-center gap-1 rounded border border-[#30363d] px-2 py-1.5 text-[10px] text-gray-300">{showSecrets ? <EyeOff size={11} /> : <Eye size={11} />}{showSecrets ? '隐藏敏感字段' : '显示敏感字段'}</button>
      <button onClick={clearSensitive} className="flex items-center gap-1 rounded border border-red-500/20 px-2 py-1.5 text-[10px] text-red-300"><Trash2 size={11} />清除敏感输入</button>
    </section>

    <section className="rounded-xl border border-[#30363d] bg-[#111820] p-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px]"><ShieldCheck size={13} className="text-green-400" /><span className="text-gray-500">公开标准向量自检</span>{selfTests.length ? selfTests.map(item => <span key={item.name} className={item.passed ? "text-green-400" : "text-red-400"}>{item.name} {item.passed ? "通过" : "失败"}</span>) : <span className="text-yellow-300">执行中…</span>}</div>
    </section>

    {workspace === "symmetric" && <section className="space-y-3 rounded-xl border border-[#30363d] bg-[#111820] p-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><label className="text-[11px] text-gray-500">算法<select aria-label="对称算法" value={algorithm} onChange={event => selectAlgorithm(event.target.value as SymmetricAlgorithm)} className="field mt-1"><option value="aes">AES</option><option value="des">DES（遗留）</option><option value="3des">3DES（遗留）</option><option value="sm4">SM4</option><option value="rc4">RC4（遗留）</option></select></label><label className="text-[11px] text-gray-500">操作<select value={operation} onChange={event => setOperation(event.target.value as typeof operation)} className="field mt-1"><option value="encrypt">加密</option><option value="decrypt">解密</option></select></label><label className="text-[11px] text-gray-500">模式<select value={mode} disabled={algorithm === 'rc4'} onChange={event => { const value = event.target.value as CipherMode; setMode(value); setUseZeroIv(false); if (value === 'gcm') setPadding('none'); }} className="field mt-1">{algorithm === 'rc4' ? <option value="stream">流加密（无模式）</option> : <><option value="ecb">ECB（无需IV）</option><option value="cbc">CBC</option>{algorithm === 'aes' && <><option value="ctr">CTR</option><option value="cfb">CFB</option><option value="ofb">OFB</option><option value="gcm">GCM</option></>}{(algorithm === 'des' || algorithm === '3des') && <><option value="cfb">CFB</option><option value="ofb">OFB</option></>}</>}</select></label><label className="text-[11px] text-gray-500">填充<select value={padding} disabled={mode === 'gcm' || algorithm === 'rc4'} onChange={event => setPadding(event.target.value as CipherPadding)} className="field mt-1"><option value="pkcs7">PKCS#7</option><option value="zero">ZeroPadding</option><option value="none">无填充</option></select></label><EncodingSelect label="输入格式" value={inputEncoding} onChange={setInputEncoding} /></div>
      <label className="block text-[11px] text-gray-500">输入<textarea aria-label="密码输入" value={input} onChange={event => setInput(event.target.value)} rows={5} className="field mt-1 resize-y font-mono" /></label>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-500">密钥 HEX{algorithm === 'rc4' ? '（1–256字节）' : ''}<input aria-label="密码密钥" type={showSecrets ? 'text' : 'password'} autoComplete="off" value={keyHex} onChange={event => setKeyHex(event.target.value)} className="field mt-1 font-mono" /></label>{mode !== 'ecb' && algorithm !== 'rc4' && <label className="text-[11px] text-gray-500">{mode === 'gcm' ? 'Nonce HEX（必填，12–16字节）' : `IV HEX（必填，${algorithm === 'des' || algorithm === '3des' ? 8 : 16}字节）`}<input aria-label="密码向量" type={showSecrets ? 'text' : 'password'} autoComplete="off" value={ivHex} disabled={useZeroIv} onChange={event => setIvHex(event.target.value)} className="field mt-1 font-mono disabled:opacity-50" /></label>}{mode === 'gcm' && <label className="text-[11px] text-gray-500">AAD HEX（可选）<input value={aadHex} onChange={event => setAadHex(event.target.value)} className="field mt-1 font-mono" /></label>}</div>
      {mode === 'ecb' && algorithm !== 'rc4' && <p className="text-[10px] text-blue-300">ECB模式不使用IV，IV HEX无需填写。</p>}
      {mode !== 'ecb' && mode !== 'gcm' && algorithm !== 'rc4' && <label className="flex items-center gap-2 text-[11px] text-gray-400"><input aria-label="使用全零IV" type="checkbox" checked={useZeroIv} onChange={event => setUseZeroIv(event.target.checked)} />使用全零IV（遗留协议兼容；勾选后可不填写IV HEX）</label>}
      {useZeroIv && <p className="text-[10px] text-yellow-400">本次计算明确使用全零IV。仅用于核对已有设备或协议，不建议用于新设计。</p>}
      <div className="flex items-end gap-2"><EncodingSelect label="输出格式" value={outputEncoding} onChange={setOutputEncoding} /><button onClick={() => void executeSymmetric()} disabled={busy || selfTests.some(item => !item.passed)} className="rounded bg-blue-600 px-4 py-2 text-xs text-white disabled:opacity-40">{busy ? '执行中…' : operation === 'encrypt' ? '执行加密' : '执行解密'}</button></div>
      <label className="block text-[11px] text-gray-500">预期{operation === 'encrypt' ? '密文' : '明文'}（可选，使用当前输出格式）<textarea aria-label="预期计算结果" value={expectedOutput} onChange={event => { setExpectedOutput(event.target.value); setComparison(null); }} rows={3} className="field mt-1 resize-y font-mono" /></label>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}{output && <div><div className="mb-1 flex items-center justify-between text-[11px] text-gray-500"><span>输出结果</span><button onClick={() => void navigator.clipboard.writeText(output)} className="flex items-center gap-1 text-blue-300"><Copy size={11} />复制</button></div><textarea aria-label="密码输出" readOnly value={output} rows={5} className="field resize-y font-mono" /></div>}
      {comparison && <p role="status" className={`text-xs ${comparison.matches ? 'text-green-400' : 'text-red-400'}`}>{comparison.matches
        ? `核对一致 · ${comparison.actualLength} 字节`
        : `核对不一致 · 首个差异位于字节偏移 ${comparison.mismatchOffset}；计算 ${comparison.actualLength} 字节，预期 ${comparison.expectedLength} 字节${comparison.actualByte === null && comparison.expectedByte === null ? '' : `；计算值 ${comparison.actualByte === null ? '无' : `0x${comparison.actualByte.toString(16).padStart(2, '0').toUpperCase()}`}，预期值 ${comparison.expectedByte === null ? '无' : `0x${comparison.expectedByte.toString(16).padStart(2, '0').toUpperCase()}`}`}`}</p>}
      {(algorithm === 'des' || algorithm === '3des' || algorithm === 'rc4') && <p className="text-[10px] text-yellow-400">{algorithm === 'rc4' ? 'RC4存在已知安全弱点，仅用于兼容遗留设备和协议核验，不建议用于新设计。' : 'DES与3DES仅用于兼容遗留设备，不建议用于新设计。'}</p>}
    </section>}

    {workspace === "digest" && <section className="space-y-3 rounded-xl border border-[#30363d] bg-[#111820] p-4"><div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-500">摘要算法<select value={digestAlgorithm} onChange={event => setDigestAlgorithm(event.target.value as DigestAlgorithm)} className="field mt-1"><option value="sm3">SM3</option><option value="sha256">SHA-256</option><option value="sha512">SHA-512</option><option value="sha1">SHA-1（遗留）</option><option value="md5">MD5（遗留）</option></select></label><EncodingSelect label="输入格式" value={digestEncoding} onChange={setDigestEncoding} /></div><textarea aria-label="摘要输入" value={digestInput} onChange={event => setDigestInput(event.target.value)} rows={6} className="field resize-y font-mono" /><label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={hmac} onChange={event => setHmac(event.target.checked)} />使用HMAC</label>{hmac && <label className="block text-[11px] text-gray-500">HMAC密钥 HEX<input aria-label="HMAC密钥" type={showSecrets ? 'text' : 'password'} autoComplete="off" value={hmacKey} onChange={event => setHmacKey(event.target.value)} className="field mt-1 font-mono" /></label>}<button onClick={executeDigest} className="rounded bg-blue-600 px-4 py-2 text-xs text-white">{hmac ? '计算HMAC' : '计算摘要'}</button>{error && <p role="alert" className="text-xs text-red-400">{error}</p>}{digestResult && <textarea aria-label="摘要结果" readOnly value={digestResult} rows={3} className="field font-mono" />}</section>}

    {workspace === "sm2" && <section className="space-y-3 rounded-xl border border-[#30363d] bg-[#111820] p-4"><div className="flex flex-wrap gap-2"><label className="text-[11px] text-gray-500">操作<select value={sm2Operation} onChange={event => setSm2Operation(event.target.value as typeof sm2Operation)} className="field mt-1"><option value="encrypt">公钥加密</option><option value="decrypt">私钥解密</option><option value="sign">私钥签名</option><option value="verify">公钥验签</option></select></label><EncodingSelect label="明文/消息格式" value={sm2Encoding} onChange={setSm2Encoding} /><label className="text-[11px] text-gray-500">密文顺序<select value={cipherMode} onChange={event => setCipherMode(Number(event.target.value) as 0 | 1)} className="field mt-1"><option value={1}>C1C3C2</option><option value={0}>C1C2C3</option></select></label><button onClick={createKeys} className="mt-auto flex items-center gap-1 rounded border border-blue-500/30 px-3 py-2 text-xs text-blue-300"><KeyRound size={12} />生成临时密钥对</button></div><label className="block text-[11px] text-gray-500">输入<textarea aria-label="SM2输入" value={sm2Input} onChange={event => setSm2Input(event.target.value)} rows={4} className="field mt-1 resize-y font-mono" /></label><div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-500">私钥 HEX<input aria-label="SM2私钥" type={showSecrets ? 'text' : 'password'} autoComplete="off" value={privateKey} onChange={event => setPrivateKey(event.target.value)} className="field mt-1 font-mono" /></label><label className="text-[11px] text-gray-500">公钥 HEX<textarea aria-label="SM2公钥" value={publicKey} onChange={event => setPublicKey(event.target.value)} rows={2} className="field mt-1 resize-y font-mono" /></label></div>{(sm2Operation === 'sign' || sm2Operation === 'verify') && <div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-500">用户标识<input value={userId} onChange={event => setUserId(event.target.value)} className="field mt-1" /></label><label className="flex items-end gap-2 pb-2 text-xs text-gray-400"><input type="checkbox" checked={der} onChange={event => setDer(event.target.checked)} />ASN.1 DER签名格式</label></div>}{sm2Operation === 'verify' && <label className="block text-[11px] text-gray-500">待验证签名 HEX<textarea aria-label="SM2签名" value={signature} onChange={event => setSignature(event.target.value)} rows={3} className="field mt-1 resize-y font-mono" /></label>}<button onClick={executeSm2} className="rounded bg-blue-600 px-4 py-2 text-xs text-white">执行{sm2Operation === 'encrypt' ? '加密' : sm2Operation === 'decrypt' ? '解密' : sm2Operation === 'sign' ? '签名' : '验签'}</button>{sm2Error && <p role="alert" className="text-xs text-red-400">{sm2Error}</p>}{sm2Output && <textarea aria-label="SM2输出" readOnly value={sm2Output} rows={5} className="field resize-y font-mono" />}</section>}

    <p className="text-[10px] text-gray-600">所有输入仅在当前浏览器内存中处理，不写入工具历史。此工具用于开发联调和结果核验，不替代生产密钥管理或密码设备。</p>
  </div>;
}
