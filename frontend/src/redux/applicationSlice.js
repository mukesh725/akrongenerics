// Application State Reducer & Action Definitions
export const initialState = {
  applications: [],
  activeFilter: 'ALL',
  selectedApp: null,
  loading: false,
  error: null
};

export const ACTIONS = {
  SET_APPLICATIONS: 'SET_APPLICATIONS',
  SELECT_APPLICATION: 'SELECT_APPLICATION',
  SET_FILTER: 'SET_FILTER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR'
};

export function applicationReducer(state = initialState, action) {
  switch (action.type) {
    case ACTIONS.SET_APPLICATIONS:
      return { ...state, applications: action.payload, loading: false };
    case ACTIONS.SELECT_APPLICATION:
      return { ...state, selectedApp: action.payload };
    case ACTIONS.SET_FILTER:
      return { ...state, activeFilter: action.payload };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}
