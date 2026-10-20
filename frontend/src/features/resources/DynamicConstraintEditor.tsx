import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ConstraintOperator, ParameterDefinition, SelectionConstraint, SelectionValueType } from '../../types';
import { getParameterDefinitions } from './selectionRegistry';

const operatorLabels: Record<ConstraintOperator, string> = {
  equals: '等于', 'not-equals': '不等于', 'at-least': '大于等于', 'at-most': '小于等于', 'greater-than': '大于', 'less-than': '小于',
  'contains-range': '覆盖目标范围', 'within-range': '位于目标范围', 'contains-any': '包含任一项', 'contains-all': '包含全部项',
  supported: '支持', unsupported: '不支持', 'manual-verification': '人工核验',
};

const defaultOperator = (definition: ParameterDefinition) => definition.supportedOperators[0] ?? 'manual-verification';

function constraintFromDefinition(definition: ParameterDefinition): SelectionConstraint {
  const operator = defaultOperator(definition);
  return {
    id: crypto.randomUUID(), parameterId: definition.id, parameterKey: definition.parameterKey, valueType: definition.valueType, operator,
    ...(definition.valueType === 'range' ? { min: 0, max: 0 } : definition.valueType === 'boolean' ? { value: true } : definition.valueType === 'number' ? { value: 0 } : { value: definition.enumValues?.[0] ?? '' }),
    ...(definition.canonicalUnit ? { unit: definition.canonicalUnit } : {}), priority: 'required', source: 'user',
  };
}

function ConstraintValue({ constraint, definition, onChange }: { constraint: SelectionConstraint; definition?: ParameterDefinition; onChange: (next: SelectionConstraint) => void }) {
  if (constraint.operator === 'manual-verification' || constraint.priority === 'undetermined') return <span className="text-[10px] text-yellow-400">保留为待确认项</span>;
  if (constraint.valueType === 'range') return <div className="flex min-w-0 items-center gap-1"><input aria-label="范围下限" type="number" value={constraint.min ?? ''} onChange={event => onChange({ ...constraint, min: Number(event.target.value) })} className="field min-w-0" /><span className="text-gray-600">—</span><input aria-label="范围上限" type="number" value={constraint.max ?? ''} onChange={event => onChange({ ...constraint, max: Number(event.target.value) })} className="field min-w-0" /></div>;
  if (constraint.valueType === 'boolean') return <select aria-label="条件值" value={String(constraint.value ?? true)} onChange={event => onChange({ ...constraint, value: event.target.value === 'true' })} className="field"><option value="true">是</option><option value="false">否</option></select>;
  if (definition?.enumValues?.length) return <select aria-label="条件值" value={String(constraint.value ?? '')} onChange={event => onChange({ ...constraint, value: event.target.value })} className="field"><option value="">请选择</option>{definition.enumValues.map(value => <option key={value}>{value}</option>)}</select>;
  return <input aria-label="条件值" type={constraint.valueType === 'number' ? 'number' : 'text'} value={Array.isArray(constraint.value) ? constraint.value.join(', ') : String(constraint.value ?? '')} onChange={event => onChange({ ...constraint, value: constraint.valueType === 'number' ? Number(event.target.value) : ['contains-any', 'contains-all'].includes(constraint.operator) ? event.target.value.split(',').map(item => item.trim()).filter(Boolean) : event.target.value })} placeholder={constraint.valueType === 'enum' ? '多项用逗号分隔' : ''} className="field" />;
}

export default function DynamicConstraintEditor({ categoryId, constraints, onChange }: { categoryId: string; constraints: SelectionConstraint[]; onChange: (next: SelectionConstraint[]) => void }) {
  const definitions = useMemo(() => getParameterDefinitions(categoryId), [categoryId]);
  const [definitionId, setDefinitionId] = useState(definitions[0]?.id ?? '');
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customType, setCustomType] = useState<SelectionValueType>('text');
  const replace = (id: string, next: SelectionConstraint) => onChange(constraints.map(item => item.id === id ? next : item));
  const addRegistered = () => { const definition = definitions.find(item => item.id === definitionId); if (definition) onChange([...constraints, constraintFromDefinition(definition)]); };
  const addCustom = () => {
    if (!customName.trim()) return;
    onChange([...constraints, { id: crypto.randomUUID(), parameterKey: customKey.trim() || undefined, customName: customName.trim(), valueType: customType, operator: customKey.trim() ? (customType === 'range' ? 'contains-range' : 'equals') : 'manual-verification', ...(customType === 'range' ? { min: 0, max: 0 } : customType === 'boolean' ? { value: true } : customType === 'number' ? { value: 0 } : { value: '' }), priority: 'required', source: 'user' }]);
    setCustomName(''); setCustomKey(''); setAddingCustom(false);
  };

  return <div className="space-y-3">
    <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
      <div className="flex flex-wrap gap-2">{definitions.length > 0 && <><select aria-label="参数定义" value={definitionId} onChange={event => setDefinitionId(event.target.value)} className="field min-w-[180px] flex-1">{definitions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button onClick={addRegistered} disabled={!definitionId} className="rounded border border-blue-500/40 px-3 py-2 text-xs text-blue-300 disabled:opacity-40"><Plus size={13} className="mr-1 inline" />添加参数</button></>}<button onClick={() => setAddingCustom(value => !value)} className="rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"><Plus size={13} className="mr-1 inline" />自定义条件</button></div>
      {definitions.length === 0 && <p className="mt-2 text-[11px] text-yellow-400">此角色暂未安装参数适配器，可添加自定义条件并保留人工核验项。</p>}
      {addingCustom && <div className="mt-3 grid gap-2 border-t border-[#30363d] pt-3 sm:grid-cols-[1fr_1fr_130px_auto]"><input aria-label="自定义条件名称" value={customName} onChange={event => setCustomName(event.target.value)} placeholder="条件名称" className="field" /><input aria-label="自定义参数键" value={customKey} onChange={event => setCustomKey(event.target.value)} placeholder="参数键（可留空）" className="field" /><select aria-label="自定义值类型" value={customType} onChange={event => setCustomType(event.target.value as SelectionValueType)} className="field"><option value="text">文本</option><option value="number">数值</option><option value="range">范围</option><option value="enum">枚举</option><option value="boolean">布尔</option></select><button onClick={addCustom} className="rounded bg-blue-600 px-3 py-2 text-xs text-white">确认</button></div>}
    </div>
    {constraints.length === 0 ? <div className="rounded-lg border border-dashed border-[#30363d] py-10 text-center text-xs text-gray-600">尚未添加条件；没有条件时只展示候选，不作资格承诺。</div> : constraints.map(constraint => {
      const definition = definitions.find(item => item.id === constraint.parameterId);
      const operators = definition?.supportedOperators ?? ['equals', 'not-equals', 'at-least', 'at-most', 'contains-range', 'contains-any', 'contains-all', 'supported', 'unsupported', 'manual-verification'];
      return <article key={constraint.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"><div className="mb-2 flex items-start justify-between gap-2"><div><b className="text-xs text-gray-200">{constraint.customName || definition?.label || '自定义条件'}</b><p className="mt-0.5 text-[10px] text-gray-600">{definition?.description || (constraint.parameterKey ? `参数键：${constraint.parameterKey}` : '未映射参数键，只能人工核验')}</p></div><button aria-label={`删除 ${constraint.customName || definition?.label || '条件'}`} onClick={() => onChange(constraints.filter(item => item.id !== constraint.id))} className="text-gray-600 hover:text-red-400"><Trash2 size={14} /></button></div><div className="grid gap-2 sm:grid-cols-[120px_150px_minmax(140px,1fr)_90px]">
        <select aria-label="优先级" value={constraint.priority} onChange={event => replace(constraint.id, { ...constraint, priority: event.target.value as SelectionConstraint['priority'] })} className="field"><option value="required">必须</option><option value="preferred">优先</option><option value="reference">参考</option><option value="undetermined">未确定</option></select>
        <select aria-label="运算关系" value={constraint.operator} onChange={event => replace(constraint.id, { ...constraint, operator: event.target.value as ConstraintOperator })} className="field">{operators.map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}</select>
        <ConstraintValue constraint={constraint} definition={definition} onChange={next => replace(constraint.id, next)} />
        {(definition?.allowedUnits?.length ?? 0) > 0 ? <select aria-label="单位" value={constraint.unit ?? definition?.canonicalUnit ?? ''} onChange={event => replace(constraint.id, { ...constraint, unit: event.target.value })} className="field">{definition!.allowedUnits!.map(unit => <option key={unit}>{unit}</option>)}</select> : <span className="self-center text-[10px] text-gray-600">{constraint.unit || '无单位'}</span>}
      </div></article>;
    })}
  </div>;
}
