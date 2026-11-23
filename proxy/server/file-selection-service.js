import { randomUUID } from 'crypto';
import { open, stat } from 'fs/promises';
import { isAbsolute, resolve } from 'path';

export const FILE_SELECTION_API_VERSION = 1;

export function createFileSelectionService({
  picker,
  maxSelections = 32,
  maxFileBytes = 512 * 1024 * 1024,
  maxChunkBytes = 256 * 1024,
  ttlMs = 15 * 60 * 1000,
  now = Date.now,
} = {}) {
  if (!picker || typeof picker.select !== 'function') throw new Error('File selection service requires a picker adapter');
  const selections = new Map();
  let activePicker = false;
  let pickerAdapter = picker;

  const getSelection = (id, requiredKind) => {
    const selection = selections.get(id);
    if (!selection || selection.expiresAt <= now()) { selections.delete(id); throw new Error('File selection is missing or expired'); }
    if (requiredKind && selection.kind !== requiredKind) throw new Error(`Selection is not a ${requiredKind}`);
    return selection;
  };
  const createSelection = (kind, path, info) => {
    if (kind === 'file' && info.size > maxFileBytes) throw new Error(`Selected file exceeds ${maxFileBytes} bytes`);
    const timestamp = now(), selectionId = randomUUID();
    for (const [id, selection] of selections) if (selection.expiresAt <= timestamp) selections.delete(id);
    while (selections.size >= maxSelections) selections.delete(selections.keys().next().value);
    const selection = { id: selectionId, kind, path, name: path.split(/[\\/]/).filter(Boolean).pop() || path, size: kind === 'file' ? info.size : undefined, modifiedAt: info.mtime.toISOString(), expiresAt: timestamp + ttlMs };
    selections.set(selectionId, selection);
    return { cancelled: false, kind, path, name: selection.name, selectionId, size: selection.size, modifiedAt: selection.modifiedAt, expiresAt: new Date(selection.expiresAt).toISOString() };
  };

  return {
    apiVersion: FILE_SELECTION_API_VERSION,
    configurePicker(nextPicker) {
      if (!nextPicker || typeof nextPicker.select !== 'function') throw new Error('File picker adapter must provide select()');
      pickerAdapter = nextPicker;
    },
    createSelection,
    getSelection,
    revoke: id => selections.delete(id),
    async selectPath(options = {}) {
      const kind = options.kind === 'file' ? 'file' : options.kind === 'directory' ? 'directory' : '';
      const purpose = options.purpose === 'serial-driver-inf' ? 'serial-driver-inf' : 'general';
      if (!kind) throw new Error('Picker kind must be file or directory');
      if (activePicker) throw new Error('A system file picker is already open');
      activePicker = true;
      try {
        const result = await pickerAdapter.select({ kind, purpose });
        if (result?.cancelled || !result?.path) return { cancelled: true, kind };
        if (!isAbsolute(result.path) || /[\0\r\n]/.test(result.path)) throw new Error('System picker returned an invalid path');
        const path = resolve(result.path), info = await stat(path);
        if (kind === 'directory' ? !info.isDirectory() : !info.isFile()) throw new Error(`Selected path is not a ${kind}`);
        return createSelection(kind, path, info);
      } finally { activePicker = false; }
    },
    async readChunk(id, offsetValue, lengthValue) {
      const selection = getSelection(id, 'file'), info = await stat(selection.path);
      if (!info.isFile() || info.size !== selection.size) throw new Error('Selected file changed after authorization');
      const offset = Number(offsetValue ?? 0), length = Number(lengthValue ?? maxChunkBytes);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Chunk offset must be a non-negative integer');
      if (!Number.isSafeInteger(length) || length < 1 || length > maxChunkBytes) throw new Error(`Chunk length must be between 1 and ${maxChunkBytes}`);
      if (offset > info.size) throw new Error('Chunk offset exceeds file size');
      const end = Math.min(info.size, offset + length), handle = await open(selection.path, 'r');
      try { const buffer = Buffer.alloc(end - offset), { bytesRead } = await handle.read(buffer, 0, buffer.length, offset); return { selectionId: id, offset, byteLength: bytesRead, size: info.size, eof: offset + bytesRead >= info.size, encoding: 'base64', data: buffer.subarray(0, bytesRead).toString('base64') }; }
      finally { await handle.close(); }
    },
  };
}
