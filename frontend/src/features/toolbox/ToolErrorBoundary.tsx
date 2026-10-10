import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; onBack: () => void }
interface State { failed: boolean; message: string }

export default class ToolErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EmbedKit tool failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-6"><h2 className="text-sm font-semibold text-red-300">当前工具运行异常</h2><p className="mt-2 text-xs text-gray-400">{this.state.message || '工具未能正常加载，其他功能不受影响。'}</p><div className="mt-4 flex gap-2"><button onClick={() => this.setState({ failed: false, message: '' })} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">重新加载工具</button><button onClick={this.props.onBack} className="rounded-lg border border-[#30363d] px-3 py-2 text-xs text-gray-300">返回工具箱</button></div></div>;
  }
}
