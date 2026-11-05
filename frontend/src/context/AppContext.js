// Global Application State & Context Management
export class AppContext {
  constructor() {
    this.listeners = [];
    this.state = {
      activeRep: null,
      draftKey: 'akron_app_draft',
      activeFilter: 'ALL',
      notification: null
    };
  }

  getState() {
    return this.state;
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l(this.state));
  }
}

export const appContext = new AppContext();
