import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  resetKey: string;
  onHome: () => void;
  onReload?: () => void;
}

interface State {
  failed: boolean;
  resetKey: string;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { failed: false, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not expose exception text, stack traces or local paths in the recovery UI.
    console.error('EmbedKit page rendering failed; the application recovery view is active.');
  }

  private retry = () => this.setState({ failed: false });

  private goHome = () => {
    this.setState({ failed: false });
    this.props.onHome();
  };

  private reload = () => (this.props.onReload ?? (() => window.location.reload()))();

  render() {
    if (!this.state.failed) return this.props.children;

    return <div className="flex h-full min-h-80 items-center justify-center overflow-y-auto p-6">
      <section role="alert" className="w-full max-w-lg rounded-2xl border border-red-500/20 bg-[#161b22] p-6 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-xl text-red-300" aria-hidden="true">!</div>
        <h1 className="mt-4 text-base font-semibold text-white">当前页面运行异常</h1>
        <p className="mt-2 text-xs leading-5 text-gray-400">页面已被安全隔离，其他工作区和已保存的数据不受影响。可以先重试；如果异常持续，请重新加载应用。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={this.retry} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500">重试当前页面</button>
          <button onClick={this.goHome} className="rounded-lg border border-[#30363d] px-4 py-2 text-xs text-gray-300 hover:bg-white/5">返回工作台</button>
          <button onClick={this.reload} className="rounded-lg border border-[#30363d] px-4 py-2 text-xs text-gray-300 hover:bg-white/5">重新加载应用</button>
        </div>
      </section>
    </div>;
  }
}
