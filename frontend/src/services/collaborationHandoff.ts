import type { EngineeringProject } from '../types/product';

export const COLLABORATION_HANDOFF_PROJECT_LIMIT = 500;

export function createCollaborationHandoff(projects: EngineeringProject[], generatedAt = new Date().toISOString()) {
  if (projects.length > COLLABORATION_HANDOFF_PROJECT_LIMIT) throw new Error(`单次交接最多包含 ${COLLABORATION_HANDOFF_PROJECT_LIMIT} 个工程`);
  return JSON.stringify({
    schema: 'embedkit.collaboration-handoff',
    version: 1,
    generatedAt,
    privacy: { excluded: ['源码内容', '本机绝对路径', '目录授权令牌', '密钥', '固件内容'] },
    workflowBoundary: '此文件是本地工程索引交接清单，不创建团队、远程仓库、邀请链接或访问权限。',
    projects: projects.map(project => ({
      id: project.id,
      schemaVersion: project.schemaVersion,
      name: project.name,
      description: project.description,
      productModel: project.productModel,
      chipModel: project.chipModel,
      group: project.group,
      tags: project.tags,
      source: project.source,
      pathStatus: 'unverified',
      recognition: project.recognition,
      inventory: project.inventory ? { ...project.inventory, entries: [] } : undefined,
      artifacts: project.artifacts,
      featureSummaries: (project.features ?? []).map(feature => ({ id: feature.id, name: feature.name, description: feature.description, source: feature.source, status: feature.status, relatedFiles: feature.relatedFiles })),
      environmentRequirements: project.environmentRequirements,
      updatedAt: project.updatedAt,
    })),
  }, null, 2);
}
