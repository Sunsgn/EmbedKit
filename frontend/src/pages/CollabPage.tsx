import { useState } from 'react';
import {
  Users,
  UserPlus,
  Share2,
  MessageSquare,
  GitBranch,
  GitCommit,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Bell,
  Search,
  Code2,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'online' | 'offline' | 'away';
  lastActive: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  members: number;
  lastCommit: string;
  branch: string;
  color: string;
}

interface Activity {
  id: string;
  user: string;
  action: string;
  file: string;
  time: string;
  type: 'commit' | 'push' | 'review' | 'comment';
}

const teamMembers: TeamMember[] = [
  { id: '1', name: 'Alex Chen', avatar: 'AC', role: 'owner', status: 'online', lastActive: 'Now' },
  { id: '2', name: 'Sarah Li', avatar: 'SL', role: 'admin', status: 'online', lastActive: '2m ago' },
  { id: '3', name: 'Mike Wang', avatar: 'MW', role: 'member', status: 'away', lastActive: '15m ago' },
  { id: '4', name: 'Emily Zhang', avatar: 'EZ', role: 'member', status: 'offline', lastActive: '1h ago' },
  { id: '5', name: 'David Liu', avatar: 'DL', role: 'viewer', status: 'offline', lastActive: '3h ago' },
];

const projects: Project[] = [
  { id: '1', name: 'STM32 Motor Control', description: 'FOC motor controller for BLDC', members: 3, lastCommit: '2 hours ago', branch: 'main', color: 'from-blue-500 to-cyan-500' },
  { id: '2', name: 'ESP32 IoT Sensor', description: 'Temperature & humidity sensor node', members: 5, lastCommit: '1 day ago', branch: 'develop', color: 'from-green-500 to-emerald-500' },
  { id: '3', name: 'RISC-V RTOS Driver', description: 'USB CDC-ACM for RISC-V chips', members: 2, lastCommit: '3 days ago', branch: 'main', color: 'from-purple-500 to-pink-500' },
  { id: '4', name: 'NRF52 BLE Stack', description: 'Custom BLE GATT server', members: 4, lastCommit: '5 days ago', branch: 'feature/ble5', color: 'from-orange-500 to-red-500' },
];

const activities: Activity[] = [
  { id: '1', user: 'Sarah Li', action: 'committed to', file: 'motor_control.c', time: '2m ago', type: 'commit' },
  { id: '2', user: 'Mike Wang', action: 'pushed to', file: 'feature/foc-algorithm', time: '15m ago', type: 'push' },
  { id: '3', user: 'Emily Zhang', action: 'reviewed', file: 'PR #42: Add PWM config', time: '1h ago', type: 'review' },
  { id: '4', user: 'Alex Chen', action: 'commented on', file: 'Issue #17: Dead zone bug', time: '2h ago', type: 'comment' },
  { id: '5', user: 'Sarah Li', action: 'merged', file: 'PR #41: Update linker script', time: '3h ago', type: 'commit' },
  { id: '6', user: 'David Liu', action: 'pushed to', file: 'docs/api-reference', time: '5h ago', type: 'push' },
];

export default function CollabPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'team' | 'activity'>('projects');
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = () => {
    const link = `https://embedkit.dev/join/${Math.random().toString(36).substring(7)}`;
    setInviteLink(link);
    setShowInvite(true);
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const roleColors: Record<string, string> = {
    owner: 'bg-yellow-500/20 text-yellow-400',
    admin: 'bg-red-500/20 text-red-400',
    member: 'bg-blue-500/20 text-blue-400',
    viewer: 'bg-gray-500/20 text-gray-400',
  };

  const statusColors: Record<string, string> = {
    online: 'bg-green-400',
    offline: 'bg-gray-500',
    away: 'bg-yellow-400',
  };

  const activityIcons: Record<string, any> = {
    commit: GitCommit,
    push: GitBranch,
    review: CheckCircle2,
    comment: MessageSquare,
  };

  const activityIconColors: Record<string, string> = {
    commit: 'text-green-400',
    push: 'text-blue-400',
    review: 'text-purple-400',
    comment: 'text-orange-400',
  };

  return (
    <div className="flex h-full bg-[#0d1117]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-400" />
            <span className="text-sm font-medium text-white">Collaboration</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <UserPlus size={14} />
              Invite
            </button>
            <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c2128] transition-colors">
              <Bell size={16} />
            </button>
          </div>
        </div>

        {/* Invite Modal */}
        {showInvite && (
          <div className="mx-4 mt-3 bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Invite Link</span>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-white">
                <XCircle size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-gray-300 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  copied ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-[#161b22] border-b border-[#30363d] px-4">
          <div className="flex gap-1">
            {(['projects', 'team', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-[#0d1117] text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects
                  .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((project) => (
                    <div
                      key={project.id}
                      className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#484f58] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center`}>
                            <Code2 size={14} className="text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                              {project.name}
                            </h3>
                            <p className="text-xs text-gray-500">{project.description}</p>
                          </div>
                        </div>
                        <button className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Share2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {project.members}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitBranch size={12} />
                          {project.branch}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {project.lastCommit}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex items-center gap-3 hover:border-[#484f58] transition-colors"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                      {member.avatar}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#161b22] ${statusColors[member.status]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{member.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${roleColors[member.role]}`}>
                        {member.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {member.status === 'online' ? (
                        <Wifi size={12} className="text-green-400" />
                      ) : (
                        <WifiOff size={12} className="text-gray-500" />
                      )}
                      <span>{member.lastActive}</span>
                    </div>
                  </div>
                  <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c2128] transition-colors">
                    <MessageSquare size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-1">
              {activities.map((activity) => {
                const Icon = activityIcons[activity.type];
                return (
                  <div
                    key={activity.id}
                    className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex items-start gap-3 hover:border-[#484f58] transition-colors"
                  >
                    <div className="mt-0.5">
                      <Icon size={16} className={activityIconColors[activity.type]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200">
                        <span className="font-medium text-white">{activity.user}</span>
                        {' '}{activity.action}{' '}
                        <span className="text-blue-400 font-mono">{activity.file}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock size={10} />
                        <span>{activity.time}</span>
                      </div>
                    </div>
                    <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c2128] transition-colors shrink-0">
                      <Eye size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {teamMembers.filter((m) => m.status === 'online').length} online
          </span>
          <span>{teamMembers.length} team members</span>
        </div>
      </div>
    </div>
  );
}
