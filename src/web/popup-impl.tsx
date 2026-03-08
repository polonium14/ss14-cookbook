import {
  Dispatch,
  Ref,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export type PopupPlacement =
  | 'above'
  | 'below'
  | 'left'
  | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface PopupTrigger<
  EPopup extends HTMLElement | SVGElement,
  EParent extends HTMLElement | SVGElement
> {
  visible: boolean;
  popupRef: Ref<EPopup>;
  parentRef: Ref<EParent>;
}

export interface PopupTriggerOptions {
  open?: boolean;
  intentTimeout?: number;
  // If true, the popup stays open when the cursor hovers on it 
  interactive?: boolean;
}

export function usePopupTrigger<
  EPopup extends HTMLElement | SVGElement,
  EParent extends HTMLElement | SVGElement = HTMLElement
>(
  placement: PopupPlacement,
  content?: any,
  {
    open: forceOpen,
    intentTimeout = 300,
    interactive = false,
  }: PopupTriggerOptions = {}
): PopupTrigger<EPopup, EParent> {
  const [visible, setVisible] = useState(false);

  const open = forceOpen ?? visible;

  const [parent, setParent] = useState<EParent | null>(null);

  const instRef = useRef<PopupInstance | null>(null);

  useEffect(() => {
    if (!parent) {
      return;
    }

    const popup: PopupInstance = {
      trigger: parent,
      popupElement: null,
      intentTimeout,
      interactive,
      setVisible,
    };

    instRef.current = popup;
    register(popup);
    return () => {
      unregister(popup);
      instRef.current = null;
    };
  }, [parent, intentTimeout, interactive]);

  const popupRef = useCallback((el: EPopup | null) => {
    const inst = instRef.current;
    if (inst) {
      if (inst.popupElement) {
        popupElements.delete(inst.popupElement);
      }
      inst.popupElement = el;
      if (el) {
        popupElements.set(el, inst);
      }
    }
  }, []) as Ref<EPopup>;

  useEffect(() => {
    const popup = instRef.current?.popupElement ?? null;
    if (!open || !popup || !parent) {
      return;
    }

    const { x, y } = placePopup(
      placement,
      parent.getBoundingClientRect(),
      (popup as HTMLElement).getBoundingClientRect()
    );

    (popup as HTMLElement).style.left = `${Math.round(x)}px`;
    (popup as HTMLElement).style.top = `${Math.round(y)}px`;
  }, [open, placement, parent, content]);

  return { visible: open, popupRef, parentRef: setParent };
}

type TriggerElement = HTMLElement | SVGElement;

interface PopupInstance {
  readonly trigger: TriggerElement;
  popupElement: TriggerElement | null;
  readonly intentTimeout: number;
  readonly interactive: boolean;
  readonly setVisible: Dispatch<SetStateAction<boolean>>;
}

let popupTimeoutId: number | null = null;
let leaveTimeoutId: number | null = null;
const popups = new Map<TriggerElement, PopupInstance>();
const popupElements = new Map<TriggerElement, PopupInstance>();

/**
 * Stack of open popups, from bottom (index 0) to top.
 * A child popup trigger lives inside content of its parent popup.
 */
const popupStack: PopupInstance[] = [];

/** Grace period (in ms) when the cursor leaves the trigger/popup before closing */
const LEAVE_GRACE = 200;

const getLogicalAncestors = (inst: PopupInstance): PopupInstance[] => {
  const ancestors: PopupInstance[] = [];
  let current: PopupInstance | undefined = inst;
  while (current) {
    ancestors.push(current);

    current = findOwnerPopup(current.trigger);
  }
  ancestors.reverse(); // most external first
  return ancestors;
};

/**
 * Check whether DOM node sits inside the popupElement of any
 * registered popup.
 */
const findOwnerPopup = (node: Node): PopupInstance | undefined => {
  let el = node.parentElement;
  while (el) {
    const owner = popupElements.get(el as TriggerElement);
    if (owner) return owner;
    el = el.parentElement;
  }
  return undefined;
};


const findPopupChains = (target: EventTarget | null): PopupInstance[] => {
  let deepest: PopupInstance | undefined;

  let node = target as ChildNode | null;
  while (node && !deepest) {
    deepest = popups.get(node as TriggerElement)
           ?? popupElements.get(node as TriggerElement);
    node = node.parentElement;
  }

  if (!deepest) 
    return [];

  return getLogicalAncestors(deepest);
};

const clearTimers = (): void => {
  if (popupTimeoutId !== null) {
    clearTimeout(popupTimeoutId);
    popupTimeoutId = null;
  }

  if (leaveTimeoutId !== null) {
    clearTimeout(leaveTimeoutId);
    leaveTimeoutId = null;

  }
};

const closeStackDown = (keepCount: number): void => {
  while (popupStack.length > keepCount) {
    const inst = popupStack.pop()!;

    inst.setVisible(false);
  }
};

const enter = (chain: PopupInstance[]): void => {
  if (chain.length === 0) {
    clearTimers();
    closeStackDown(0);
    return;
  }

  // How much of the existing stack matches the incoming chain
  let commonPrefix = 0;
  while (
    commonPrefix < popupStack.length &&
    commonPrefix < chain.length &&
    popupStack[commonPrefix] === chain[commonPrefix]
  ) {
    commonPrefix++;
  }

  // If the chain matches the stack exactly or the stack has more items pending already, cancel any leave timer but keep intent timers running.
  if (commonPrefix === chain.length) {
    if (leaveTimeoutId !== null) {
      clearTimeout(leaveTimeoutId);
      leaveTimeoutId = null;
    }
    return;
  }

  clearTimers();

  // Close popups that are no longer in the chain
  closeStackDown(commonPrefix);

  // Open new popups from the chain.
  const newItems = chain.slice(commonPrefix);
  const deepest = newItems[newItems.length - 1];

  // Intermediate items open immediately
  for (let i = 0; i < newItems.length - 1; i++) {
    popupStack.push(newItems[i]);
    newItems[i].setVisible(true);
  }

  // Delay for the deepest new popup
  popupStack.push(deepest);
  if (deepest.intentTimeout > 0) {
    popupTimeoutId = window.setTimeout(() => {
      popupTimeoutId = null;
      deepest.setVisible(true);
    }, deepest.intentTimeout);
  } else {
    deepest.setVisible(true);
  }
};

const leave = (immediate = false): void => {
  clearTimers();

  if (popupStack.length === 0) return;

  const topInteractive = popupStack.some(p => p.interactive);

  if (!immediate && topInteractive) {
    // Give the user a short grace period to move cursor to the popup
    const snapshot = [...popupStack];
    leaveTimeoutId = window.setTimeout(() => {
      leaveTimeoutId = null;

      if (
        popupStack.length === snapshot.length &&
        popupStack.every((p, i) => p === snapshot[i])
      ) {
        closeStackDown(0);
      }
    }, LEAVE_GRACE);
  } else {
    closeStackDown(0);
  }
};

const mouseMove = (e: MouseEvent): void => {
  const chain = findPopupChains(e.target);

  if (chain.length > 0) {
    enter(chain);
  } else {
    leave();
  }
};

const focus = (e: FocusEvent): void => {
  // Unlike mouse movements, we don't show a popup on focused descendants.
  // The exact popup trigger must be focused.
  const popup = popups.get(e.target as TriggerElement);
  if (popup) {
    enter([popup]);
  } else {
    leave();
  }
};

const blur = (e: FocusEvent): void => {
  // relatedTarget is the target that's *gaining* focus. If we're moving from
  // one popup trigger to another, let focus handle it. Otherwise, close the
  // current popup.
  const nextPopup = popups.get(e.relatedTarget as TriggerElement);
  if (!nextPopup) {
    leave();
  }
};

const scrollLeave = (): void => {
  leave(true);
};

const register = (inst: PopupInstance): void => {
  if (popups.size === 0) {
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('focusin', focus);
    window.addEventListener('focusout', blur);
    window.addEventListener('scroll', scrollLeave);
  }
  popups.set(inst.trigger, inst);
};

const unregister = (inst: PopupInstance): void => {
  popups.delete(inst.trigger);
  if (inst.popupElement) {
    popupElements.delete(inst.popupElement);
  }
  if (popups.size === 0) {
    window.removeEventListener('mousemove', mouseMove);
    window.removeEventListener('focusin', focus);
    window.removeEventListener('focusout', blur);
    window.removeEventListener('scroll', scrollLeave);
  }
  // If the unregistered instance is anywhere in the stack, close it and
  // everything above it.
  const idx = popupStack.indexOf(inst);
  if (idx >= 0) {
    closeStackDown(idx);
  }
};

/**
 * Places a popup relative to a parent element.
 * @param placement The relative location of the popup.
 * @param parentRect The parent element's location on screen.
 * @param popupRect The popup element's location on screen.
 * @param separation The distance between the popup element and the edge of
 *        the parent element.
 * @param screenMargin The minimum distance between the popup element and
 *        the edge of the screen.
 * @return The location of the popup's top left corner.
 */
export function placePopup(
  placement: PopupPlacement,
  parentRect: DOMRect,
  popupRect: DOMRect,
  separation = 6,
  screenMargin = 8
): Point {
  let x: number;
  switch (placement) {
    case 'above':
    case 'below':
      x = parentRect.x + (parentRect.width - popupRect.width) / 2;
      break;
    case 'left':
      x = parentRect.x - popupRect.width - separation;
      break;
    case 'right':
      x = parentRect.x + parentRect.width + separation;
      break;
  }
  x = clamp(
    x,
    screenMargin,
    window.innerWidth - popupRect.width - screenMargin
  );

  let y: number;
  switch (placement) {
    case 'above':
      y = parentRect.y - popupRect.height - separation;
      break;
    case 'below':
      y = parentRect.y + parentRect.height + separation;
      break;
    case 'left':
    case 'right':
      y = parentRect.y + (parentRect.height - popupRect.height) / 2;
      break;
  }
  y = clamp(
    y,
    screenMargin,
    window.innerHeight - popupRect.height - screenMargin
  );

  return { x, y };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

let root: HTMLElement | null = null;

export function getPopupRoot(): HTMLElement {
  if (!root) {
    root = document.createElement('div');
    root.dataset.purpose = 'popups';
    document.body.appendChild(root);
  }
  return root;
}
