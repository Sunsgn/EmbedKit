import { components } from '../../data/components';
import type { PartParameter, PartRecord } from '../../types';
import { migrateElectronicComponent } from '../../services/partCatalog';

const importedParameter = (input: Omit<PartParameter, 'conditions' | 'evidenceIds' | 'status'>, evidenceId: string): PartParameter => ({
  ...input,
  conditions: [],
  evidenceIds: [evidenceId],
  status: 'imported',
});

function fromBuiltin(id: string, parameters: PartParameter[]): PartRecord {
  const component = components.find(item => item.id === id);
  if (!component) throw new Error(`Missing built-in communication part: ${id}`);
  const record = migrateElectronicComponent(component);
  const document = record.documents.find(item => item.kind === 'datasheet');
  const sourceId = `manufacturer:${record.manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return {
    ...record,
    parameters,
    documents: record.documents.map(item => ({ ...item, sourceId })),
    sources: [{ id: sourceId, kind: 'manufacturer', name: `${record.manufacturer} 官方资料`, url: document?.url }],
    evidence: [{ id: `${record.id}:datasheet-link`, sourceId, documentId: document?.id, url: document?.url, note: '参数由现有目录导入；正式选型前需按具体订货后缀核对官方数据手册。' }],
  };
}

export const communicationSelectionCatalog: PartRecord[] = [
  fromBuiltin('max3485', [
    importedParameter({ key: 'bus-standard', label: '总线标准', valueType: 'enum', value: ['RS-485', 'RS-422'] }, 'part:component:max3485:datasheet-link'),
    importedParameter({ key: 'data-rate-mbps', label: '最高数据速率', valueType: 'number', value: 10, unit: 'Mbps' }, 'part:component:max3485:datasheet-link'),
    importedParameter({ key: 'supply-voltage-v', label: '标称供电', valueType: 'number', value: 3.3, unit: 'V' }, 'part:component:max3485:datasheet-link'),
  ]),
  fromBuiltin('tja1051t', [
    importedParameter({ key: 'bus-standard', label: '总线标准', valueType: 'enum', value: ['CAN', 'CAN FD'] }, 'part:component:tja1051t:datasheet-link'),
    importedParameter({ key: 'data-rate-mbps', label: '最高数据速率', valueType: 'number', value: 5, unit: 'Mbps' }, 'part:component:tja1051t:datasheet-link'),
    importedParameter({ key: 'supply-voltage-v', label: '供电范围', valueType: 'range', min: 4.5, max: 5.5, unit: 'V' }, 'part:component:tja1051t:datasheet-link'),
  ]),
];
