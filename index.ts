import { useReducer, useCallback } from 'react';
import { isDeepStrictEqual } from 'util';

const enum ActionType {
  Undo = 'UNDO',
  Redo = 'REDO',
  Set = 'SET',
  Reset = 'RESET',
}

export interface Actions<T> {
  set: (newPresent: T, checkpoint?: boolean) => void;
  reset: (newPresent: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getCount: () => number;
}

interface Action<T> {
  type: ActionType;
  historyCheckpoint?: boolean;
  newPresent?: T;
}

export interface State<T> {
  past: T[];
  present: T;
  future: T[];
  count: number;
}

const initialState = {
  past: [],
  present: null,
  future: [],
  count: 0,
};

type Options = {
  useCheckpoints?: boolean;
  maxCapacity?: number;
};

const useUndo = <T>(
  initialPresent: T,
  opts: Options = {}
): [State<T>, Actions<T>] => {
  const { useCheckpoints, maxCapacity }: Options = {
    useCheckpoints: false,
    maxCapacity: Infinity,
    ...opts,
  };

  const initialCount = Array.isArray(initialPresent)
    ? initialPresent.length
    : 0;

  const reducer = <T>(state: State<T>, action: Action<T>) => {
    const { past, present, future } = state;

    switch (action.type) {
      case ActionType.Undo: {
        if (past.length === 0) {
          return state;
        }

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);

        const newCount = Array.isArray(previous) ? previous.length : 0;

        return {
          past: newPast,
          present: previous,
          future: [present, ...future],
          count: newCount,
        };
      }

      case ActionType.Redo: {
        if (future.length === 0) {
          return state;
        }
        const next = future[0];
        const newFuture = future.slice(1);

        const newCount = Array.isArray(next) ? next.length : 0;

        return {
          past: [...past, present],
          present: next,
          future: newFuture,
          count: newCount,
        };
      }

      case ActionType.Set: {
        const isNewCheckpoint = useCheckpoints
          ? !!action.historyCheckpoint
          : true;
        const { newPresent } = action;

        if (newPresent === present || isDeepStrictEqual(newPresent, present)) {
          return state;
        }

        const newCount = Array.isArray(newPresent) ? newPresent.length : 0;

        let newPast = isNewCheckpoint === false ? past : [...past, present];

        if (
          maxCapacity &&
          maxCapacity !== Infinity &&
          newPast.length > maxCapacity
        ) {
          newPast = newPast.slice(newPast.length - maxCapacity);
        }

        return {
          past: newPast,
          present: newPresent,
          future: [],
          count: newCount,
        };
      }

      case ActionType.Reset: {
        const { newPresent } = action;

        const newCount = Array.isArray(newPresent) ? newPresent.length : 0;

        return {
          past: [],
          present: newPresent,
          future: [],
          count: newCount,
        };
      }
    }
  };

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    present: initialPresent,
    count: initialCount,
  }) as [State<T>, React.Dispatch<Action<T>>];

  const canUndo = state.past.length !== 0;
  const canRedo = state.future.length !== 0;
  const undo = useCallback(() => {
    if (canUndo) {
      dispatch({ type: ActionType.Undo });
    }
  }, [canUndo]);
  const redo = useCallback(() => {
    if (canRedo) {
      dispatch({ type: ActionType.Redo });
    }
  }, [canRedo]);
  const set = useCallback((newPresent: T, checkpoint = false) => {
    dispatch({
      type: ActionType.Set,
      newPresent,
      historyCheckpoint: checkpoint,
    });
  }, []);
  const reset = useCallback(
    (newPresent: T) => dispatch({ type: ActionType.Reset, newPresent }),
    []
  );

  const getCount = useCallback(() => {
    return state.count;
  }, [state.count]);

  return [
    state,
    {
      set,
      reset,
      undo,
      redo,
      canUndo,
      canRedo,
      getCount,
    },
  ];
};

export default useUndo;
