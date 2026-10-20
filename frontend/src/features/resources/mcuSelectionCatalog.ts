import { chips } from '../../data/chips';
import { migrateChip } from '../../services/partCatalog';
import type { Chip, PartParameter, PartRecord } from '../../types';

const numberFrom = (value: string) => Number(value.match(/[\d.]+/)?.[0] ?? 0);
const capacityKb = (value: string) => numberFrom(value) * (/MB/i.test(value) ? 1024 : 1);
const peripheralAliases = (values: string[]) => [...new Set(values.flatMap(value => {
  const upper = value.toUpperCase(), aliases = [upper];
  for (const family of ['USB', 'CAN', 'ETH', 'UART', 'USART', 'I2C', 'SPI', 'BLE', 'WIFI']) if (upper.includes(family)) aliases.push(family === 'USART' ? 'UART' : family);
  return aliases;
}))];

function imported(key: string, label: string, valueType: PartParameter['valueType'], value: PartParameter['value'], evidenceId: string, unit?: string): PartParameter {
  return { key, label, valueType, value, ...(unit ? { unit } : {}), conditions: [], evidenceIds: [evidenceId], status: 'imported' };
}

function toSelectionPart(chip: Chip): PartRecord {
  const part = migrateChip(chip), evidenceId = part.evidence[0].id;
  return { ...part, parameters: [
    imported('clock-mhz', '最高主频', 'number', numberFrom(chip.frequency), evidenceId, 'MHz'),
    imported('flash-kb', 'Flash', 'number', capacityKb(chip.flash), evidenceId, 'KB'),
    imported('ram-kb', 'RAM', 'number', capacityKb(chip.ram), evidenceId, 'KB'),
    imported('peripheral', '外设能力', 'enum', peripheralAliases(chip.peripherals), evidenceId),
  ] };
}

const manufacturerCounts = new Map<string, number>();
export const mcuSelectionCatalog = chips.filter(chip => {
  const count = manufacturerCounts.get(chip.manufacturer) ?? 0;
  if (count >= 4) return false;
  manufacturerCounts.set(chip.manufacturer, count + 1);
  return true;
}).slice(0, 20).map(toSelectionPart);
