// Central State Store
import { applicationReducer, initialState } from './applicationSlice.js';

export class Store {
  constructor(reducer, state) {
    this.reducer = reducer;
    this.state = state;
    this.subscribers = [];
  }

  getState() {
    return this.state;
  }

  dispatch(action) {
    this.state = this.reducer(this.state, action);
    this.subscribers.forEach(fn => fn(this.state));
  }

  subscribe(listener) {
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter(l => l !== listener);
    };
  }
}

export const store = new Store(applicationReducer, initialState);
