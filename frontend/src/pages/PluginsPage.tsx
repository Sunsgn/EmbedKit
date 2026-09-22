import { useState } from 'react';
import {
  Puzzle,
  Search,
  Download,
  Star,
  ExternalLink,
  Cpu,
  Zap,
  Wrench,
  Shield,
  Layers,
  MessageSquare,
  Monitor,
  Wifi,
  Check,
  X,
  Settings,
  Trash2,
  Eye,
} from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  stars: number;
  category: string;
  icon: any;
  installed: boolean;
  featured?: boolean;
}

const allPlugins: Plugin[] = [
  { id: '1', name: 'STM32 HAL Generator', description: 'Auto-generate HAL initialization code from pinout config', author: 'ST Team', version: '2.1.0', downloads: 15420, stars: 342, category: 'Code Gen', icon: Cpu, installed: true, featured: true },
  { id: '2', name: 'ESP-IDF Component Lib', description: 'Browse and add ESP-IDF components directly to your project', author: 'Espressif', version: '1.5.3', downloads: 12800, stars: 289, category: 'Library', icon: Layers, installed: true },
  { id: '3', name: 'UART Terminal Pro', description: 'Advanced serial terminal with logging, scripting, and data export', author: 'EmbedKit', version: '3.0.1', downloads: 28500, stars: 567, category: 'Debugging', icon: MessageSquare, installed: false, featured: true },
  { id: '4', name: 'JTAG Debugger', description: 'SWD/JTAG debug integration with breakpoint and memory inspection', author: 'OpenDebug', version: '1.2.0', downloads: 9800, stars: 198, category: 'Debugging', icon: Wrench, installed: false },
  { id: '5', name: 'BLE Scanner', description: 'Scan, connect, and interact with BLE devices from the IDE', author: 'Nordic Dev', version: '2.0.0', downloads: 7600, stars: 156, category: 'IoT', icon: Wifi, installed: false },
  { id: '6', name: 'RTOS Task Viewer', description: 'Visualize FreeRTOS task states, priorities, and stack usage', author: 'RTX Labs', version: '1.0.5', downloads: 5200, stars: 112, category: 'Visualization', icon: Monitor, installed: false },
  { id: '7', name: 'IoT MQTT Client', description: 'Test MQTT publish/subscribe directly from the editor', author: 'HiveMQ', version: '1.3.2', downloads: 6100, stars: 134, category: 'IoT', icon: Wifi, installed: false },
  { id: '8', name: 'Pinout Visualizer', description: 'Interactive chip pinout diagram with GPIO configuration', author: 'EmbedKit', version: '1.1.0', downloads: 18900, stars: 421, category: 'Visualization', icon: Eye, installed: true, featured: true },
  { id: '9', name: 'Secure Boot Config', description: 'Configure secure boot, flash encryption, and certificate management', author: 'SecureDev', version: '1.0.0', downloads: 3200, stars: 78, category: 'Security', icon: Shield, installed: false },
  { id: '10', name: 'Power Profiler', description: 'Measure and visualize power consumption of embedded firmware', author: 'GreenChip', version: '0.9.1', downloads: 4500, stars: 97, category: 'Testing', icon: Zap, installed: false },
  { id: '11', name: 'CMSIS-Pack Manager', description: 'Install and manage ARM CMSIS-Pack files for device support', author: 'ARM', version: '2.3.0', downloads: 11200, stars: 245, category: 'Library', icon: Layers, installed: false },
  { id: '12', name: 'Code Coverage', description: 'Generate test coverage reports for embedded unit tests', author: 'TestLab', version: '1.4.0', downloads: 3800, stars: 86, category: 'Testing', icon: Check, installed: false },
];

const categories = ['All', 'Code Gen', 'Debugging', 'Library', 'IoT', 'Visualization', 'Security', 'Testing'];

export default function PluginsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [plugins, setPlugins] = useState(allPlugins);
  const [detailPlugin, setDetailPlugin] = useState<Plugin | null>(null);

  const filtered = plugins.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, installed: !p.installed } : p))
    );
    setDetailPlugin((prev) =>
      prev && prev.id === id ? { ...prev, installed: !prev.installed } : prev
    );
  };

  const formatDownloads = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <div className="flex h-full bg-[#0d1117]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Puzzle size={18} className="text-purple-400" />
            <span className="text-sm font-medium text-white">Plugin Marketplace</span>
          </div>
          <div className="text-xs text-gray-500">
            {plugins.filter((p) => p.installed).length} installed · {plugins.length} available
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-[#161b22] border-b border-[#30363d] p-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plugins..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#0d1117] text-gray-400 hover:text-white hover:bg-[#1c2128]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin flex">
          {/* Plugin Grid */}
          <div className="flex-1 p-3">
            {/* Featured */}
            {activeCategory === 'All' && !searchTerm && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Featured</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  {filtered
                    .filter((p) => p.featured)
                    .map((plugin) => {
                      const Icon = plugin.icon;
                      return (
                        <div
                          key={plugin.id}
                          onClick={() => setDetailPlugin(plugin)}
                          className="bg-gradient-to-br from-[#161b22] to-[#1c2128] border border-[#30363d] rounded-lg p-3 cursor-pointer hover:border-purple-500/50 transition-colors"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                              <Icon size={16} className="text-purple-400" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-medium text-white truncate">{plugin.name}</h4>
                              <p className="text-xs text-gray-500">by {plugin.author}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">{plugin.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Star size={10} className="text-yellow-400" />
                              {plugin.stars}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download size={10} />
                              {formatDownloads(plugin.downloads)}
                            </span>
                            {plugin.installed && (
                              <span className="flex items-center gap-1 text-green-400">
                                <Check size={10} />
                                Installed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* All Plugins */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {activeCategory === 'All' ? 'All Plugins' : activeCategory}
            </h3>
            <div className="space-y-2">
              {filtered
                .filter((p) => !p.featured || activeCategory !== 'All' || searchTerm)
                .map((plugin) => {
                  const Icon = plugin.icon;
                  return (
                    <div
                      key={plugin.id}
                      onClick={() => setDetailPlugin(plugin)}
                      className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 cursor-pointer hover:border-[#484f58] transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#0d1117] flex items-center justify-center shrink-0">
                        <Icon size={20} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-white">{plugin.name}</h4>
                          <span className="text-xs text-gray-500">v{plugin.version}</span>
                          <span className="text-xs text-gray-600">·</span>
                          <span className="text-xs text-gray-500">{plugin.category}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{plugin.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Star size={10} className="text-yellow-400" />
                            {plugin.stars}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download size={10} />
                            {formatDownloads(plugin.downloads)}
                          </span>
                          <span>by {plugin.author}</span>
                        </div>
                      </div>
                      {plugin.installed ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstall(plugin.id);
                          }}
                          className="px-3 py-1.5 text-xs text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors shrink-0"
                        >
                          Uninstall
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstall(plugin.id);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shrink-0"
                        >
                          <Download size={12} />
                          Install
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Detail Panel */}
          {detailPlugin && (
            <div className="w-72 bg-[#161b22] border-l border-[#30363d] p-3 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase">Plugin Details</span>
                <button onClick={() => setDetailPlugin(null)} className="text-gray-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  {(() => {
                    const Icon = detailPlugin.icon;
                    return <Icon size={20} className="text-purple-400" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{detailPlugin.name}</h3>
                  <p className="text-xs text-gray-500">by {detailPlugin.author}</p>
                </div>
              </div>
              <p className="text-xs text-gray-300 mb-3">{detailPlugin.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Version</span>
                  <span className="text-white">{detailPlugin.version}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Category</span>
                  <span className="text-white">{detailPlugin.category}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Downloads</span>
                  <span className="text-white">{detailPlugin.downloads.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Rating</span>
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Star size={10} />
                    {detailPlugin.stars} stars
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {!detailPlugin.installed ? (
                  <button
                    onClick={() => handleInstall(detailPlugin.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                  >
                    <Download size={14} />
                    Install Plugin
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(detailPlugin.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Uninstall
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[#0d1117] hover:bg-[#1c2128] rounded-lg transition-colors">
                  <ExternalLink size={14} />
                  Documentation
                </button>
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[#0d1117] hover:bg-[#1c2128] rounded-lg transition-colors">
                  <Settings size={14} />
                  Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
