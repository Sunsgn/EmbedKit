export const OPEN_SOURCE_SEARCH_MAX_LENGTH = 120;

export function buildOpenSourceSearchLinks(value: string) {
  const query = value.trim().replace(/\s+/g, ' ').slice(0, OPEN_SOURCE_SEARCH_MAX_LENGTH);
  if (query.length < 2) return [];
  return [
    { id: 'github', name: 'GitHub 仓库', description: '搜索公开仓库、SDK 和示例', url: `https://github.com/search?type=repositories&q=${encodeURIComponent(query)}` },
    { id: 'gitee', name: 'Gitee 仓库', description: '搜索国内公开仓库与镜像', url: `https://search.gitee.com/?type=repository&q=${encodeURIComponent(query)}` },
    { id: 'web', name: 'Web 搜索', description: '搜索官方与项目维护者资料', url: `https://www.bing.com/search?q=${encodeURIComponent(`${query} 官方 开源 SDK 文档`)}` },
  ];
}
