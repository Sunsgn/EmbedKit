import { useState } from 'react';
import {
  Download,
  Monitor,
  Zap,
  Cpu,
  Shield,
  Globe,
  Layers,
  ChevronRight,
  Check,
  Terminal,
  Wifi,
  HardDrive,
  GitBranch,
  Box,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Feature {
  icon: any;
  title: string;
  description: string;
}

interface FAQ {
  question: string;
  answer: string;
}

const features: Feature[] = [
  { icon: Zap, title: 'Faster Performance', description: 'Native compilation with Electron delivers 10x faster build times than web version.' },
  { icon: Wifi, title: 'Offline Mode', description: 'Full IDE functionality without internet. All compilers, debuggers, and libraries work offline.' },
  { icon: Shield, title: 'Local Security', description: 'Code never leaves your machine. All AI processing can be done with local models.' },
  { icon: HardDrive, title: 'File System Access', description: 'Direct access to local file system for projects, firmware flashing, and hardware debugging.' },
  { icon: GitBranch, title: 'Git Integration', description: 'Built-in Git client with visual diff, blame, and branch management.' },
  { icon: Layers, title: 'Multi-Workspace', description: 'Open multiple projects simultaneously with separate terminals and debug sessions.' },
];

const faqs: FAQ[] = [
  { question: 'Is the desktop version free?', answer: 'Yes, EmbedKit Desktop is free for personal and educational use. A Pro plan ($9/mo) unlocks cloud collaboration, advanced AI features, and priority support.' },
  { question: 'Which platforms are supported?', answer: 'EmbedKit Desktop supports Windows 10+, macOS 12+, and Ubuntu 20.04+ (64-bit). ARM64 builds are also available for Apple Silicon.' },
  { question: 'How does it differ from the web version?', answer: 'The desktop version offers offline support, local file system access, faster builds, native hardware debugging (JTAG/SWD), and local AI model support.' },
  { question: 'Can I sync settings between web and desktop?', answer: 'Yes, sign in with your account to sync extensions, settings, keybindings, and snippets across all platforms.' },
];

interface SystemReqs {
  platform: string;
  icon: any;
  os: string;
  cpu: string;
  ram: string;
  storage: string;
}

const systems: SystemReqs[] = [
  { platform: 'Windows', icon: Monitor, os: 'Windows 10/11 (64-bit)', cpu: 'Intel i5 / AMD Ryzen 5+', ram: '8 GB RAM', storage: '500 MB' },
  { platform: 'macOS', icon: Monitor, os: 'macOS 12 Monterey+', cpu: 'Intel i5 / Apple M1+', ram: '8 GB RAM', storage: '500 MB' },
  { platform: 'Linux', icon: Terminal, os: 'Ubuntu 20.04+, Fedora 36+', cpu: 'Any 64-bit processor', ram: '4 GB RAM', storage: '400 MB' },
];

export default function DownloadPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (platform: string) => {
    setDownloading(platform);
    setTimeout(() => setDownloading(null), 2000);
  };

  return (
    <div className="flex h-full bg-[#0d1117] overflow-y-auto scrollbar-thin">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Hero */}
        <div className="relative bg-gradient-to-b from-purple-900/20 to-[#0d1117] px-4 pt-8 pb-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-400 mb-4">
              <Box size={12} />
              v2.4.0 — Released Sep 2025
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              EmbedKit Desktop
            </h1>
            <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
              The full-featured embedded development IDE. Build, debug, and flash firmware faster with native performance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleDownload('Windows')}
                disabled={downloading === 'Windows'}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {downloading === 'Windows' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download for Windows
                  </>
                )}
              </button>
              <button
                onClick={() => handleDownload('macOS')}
                disabled={downloading === 'macOS'}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-300 bg-[#161b22] hover:bg-[#1c2128] border border-[#30363d] rounded-lg transition-colors disabled:opacity-50"
              >
                {downloading === 'macOS' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    macOS
                  </>
                )}
              </button>
              <button
                onClick={() => handleDownload('Linux')}
                disabled={downloading === 'Linux'}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-300 bg-[#161b22] hover:bg-[#1c2128] border border-[#30363d] rounded-lg transition-colors disabled:opacity-50"
              >
                {downloading === 'Linux' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Linux
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="px-4 py-6">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">Why Desktop?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#484f58] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
                    <Icon size={16} className="text-purple-400" />
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Requirements */}
        <div className="px-4 py-6">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">System Requirements</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {systems.map((sys, i) => {
              const Icon = sys.icon;
              return (
                <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={18} className="text-blue-400" />
                    <h3 className="text-sm font-medium text-white">{sys.platform}</h3>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <Cpu size={12} className="text-gray-500 shrink-0" />
                      <span>{sys.cpu}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers size={12} className="text-gray-500 shrink-0" />
                      <span>{sys.ram}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive size={12} className="text-gray-500 shrink-0" />
                      <span>{sys.storage}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* What's New */}
        <div className="px-4 py-6">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">What's New in v2.4</h2>
          <div className="max-w-2xl mx-auto bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <div className="space-y-3">
              {[
                'Native JTAG/SWD debugger with hardware breakpoint support',
                'Local AI model integration for offline code assistance',
                'Multi-workspace support — open unlimited projects',
                'RISC-V toolchain support for 20+ chip families',
                'Real-time power profiling for low-power MCU design',
                'Improved serial terminal with data export (CSV, JSON)',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="px-4 py-6">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <span className="text-sm font-medium text-white">{faq.question}</span>
                  {openFAQ === i ? (
                    <ChevronUp size={14} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  )}
                </button>
                {openFAQ === i && (
                  <div className="px-3 pb-3">
                    <p className="text-xs text-gray-400 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-400 mb-3">Prefer the web version?</p>
          <a
            href="/EmbedKit/"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Globe size={14} />
            Launch Web IDE
            <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
