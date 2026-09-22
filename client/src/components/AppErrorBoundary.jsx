import { Component } from 'react';

// A minimal top-level error boundary. Without one, an error thrown while
// rendering any component unmounts the whole tree and leaves a blank white
// page. This catches such crashes, shows a friendly message, and lets the
// user recover by reloading.
export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#f8f7ff] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[rgba(199,196,216,0.5)] shadow-[0px_12px_32px_rgba(15,23,42,0.12)] p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#e2e7ff] flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-[#3525cd]">!</span>
            </div>
            <h1 className="text-lg font-bold text-[#131b2e] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#464555] mb-6">
              The app hit an unexpected error. Your data is safe — refresh to continue.
            </p>
            <button
              onClick={this.handleReset}
              className="h-10 px-5 rounded-xl text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}