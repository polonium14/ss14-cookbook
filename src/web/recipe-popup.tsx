import { ReactElement, Ref, cloneElement, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { getPopupRoot, usePopupTrigger } from './popup-impl';

const Recipe = lazy(() => import('./recipe').then(m => ({ default: m.Recipe })));

export interface Props {
  id: string | readonly string[];
  children: ReactElement<{
    ref?: Ref<HTMLElement>
  }>;
}

export const RecipePopup = ({ id, children }: Props): ReactElement => {
  const { visible, popupRef, parentRef } = usePopupTrigger<HTMLDivElement>(
    'below'
  );

  const childWithRef = cloneElement(children, {
    ref: parentRef,
  });

  return <>
    {childWithRef}
    {visible && createPortal(
      <div className='popup popup--recipe' ref={popupRef}>
        <Suspense fallback={<div>Loading...</div>}>
          {typeof id === 'string' ? renderRecipe(id) : id.map(renderRecipe)}
        </Suspense>
      </div>,
      getPopupRoot()
    )}
  </>;
};

const renderRecipe = (id: string): ReactElement =>
  <Recipe
    key={id}
    id={id}
    canExplore={false}
    canFavorite={false}
    skipDefaultHeaderAction
  />;
