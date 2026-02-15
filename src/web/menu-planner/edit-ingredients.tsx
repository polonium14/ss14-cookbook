import { ReactElement, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useGameData } from '../context';
import { NeutralCollator, dedupe } from '../helpers';
import { AddIcon, EyeIcon, EyeOffIcon, InformationIcon } from '../icons';
import { getPopupRoot, usePopupTrigger } from '../popup-impl';
import { Recipe } from '../recipe';
import { getRecipeName } from '../sort';
import { EntitySprite, ReagentSprite } from '../sprites';
import { Tooltip } from '../tooltip';
import { ingredientName } from './ingredients';
import { Ingredient } from './types';

export interface Props {
  availableIngredients: readonly Ingredient[];
  hiddenIngredients: ReadonlySet<string>,
  onToggleVisible: (id: string) => void;
  onAddRecipe: (id: string) => void;
}

export const IngredientList = memo(({
  availableIngredients,
  hiddenIngredients,
  onToggleVisible,
  onAddRecipe,
}: Props): ReactElement => {
  const { entityMap, reagentMap } = useGameData();

  const sortedIngredients = useMemo(() => {
    return availableIngredients.slice(0).sort((a, b) => {
      const nameA = ingredientName(a, entityMap, reagentMap);
      const nameB = ingredientName(b, entityMap, reagentMap);
      return NeutralCollator.compare(nameA, nameB);
    });
  }, [availableIngredients, entityMap, reagentMap]);

  return <>
    <h3>Składniki</h3>
    {sortedIngredients.length > 0 ? (
      <ul className='planner_editor-ingredient-list'>
        {sortedIngredients.map(ingredient =>
          <Ingredient
            key={ingredient.id}
            ingredient={ingredient}
            visible={!hiddenIngredients.has(ingredient.id)}
            onToggleVisible={onToggleVisible}
            onAddRecipe={onAddRecipe}
          />
        )}
      </ul>
    ) : <>
      <p>Kiedy dodasz przepisy do menu, ich składniki pojawią się tutaj. Ta lista będzie również zawierać składniki użyte w przepisach na inne składniki.</p>
      <p>Możesz ukryć składniki, których nie chcesz widzieć, i dodać ich przepisy (jeśli są dostępne) do swojego menu.</p>
    </>}
  </>;
});

interface IngredientProps {
  ingredient: Ingredient;
  visible: boolean;
  onToggleVisible: (id: string) => void;
  onAddRecipe: (id: string) => void;
}

const Ingredient = memo(({
  ingredient,
  visible,
  onToggleVisible,
  onAddRecipe,
}: IngredientProps): ReactElement => {
  const { recipeMap, entityMap, reagentMap } = useGameData();

  const sourceOfText = useMemo(() => {
    if (ingredient.sourceOfReagent.size === 0) {
      return '';
    }

    const reagentNames = Array.from(ingredient.sourceOfReagent, id =>
      reagentMap.get(id)!.name
    );
    reagentNames.sort((a, b) => NeutralCollator.compare(a, b));
    return `Źródło: ${reagentNames.join(', ')}`;
  }, [ingredient, reagentMap]);

  const usedByText = useMemo(() => {
    if (ingredient.usedBy.size === 0) {
      return '';
    }

    const recipeNames = dedupe(
      Array.from(ingredient.usedBy, id =>
        getRecipeName(recipeMap.get(id)!, entityMap, reagentMap)
      )
    );
    recipeNames.sort((a, b) => NeutralCollator.compare(a, b));
    return `Używane przez: ${recipeNames.join(', ')}`;
  }, [ingredient, recipeMap, entityMap, reagentMap]);

  const tooltipText = `${sourceOfText}\n${usedByText}`.trim();

  return (
    <li
      className={
        !visible
          ? 'planner_editor-ingredient planner_editor-ingredient--off'
          : 'planner_editor-ingredient'
      }
    >
      <Tooltip text={visible ? 'Ukryj ten składnik' : 'Pokaż ten składnik'}>
        <button
          className='planner_editor-ingredient-toggle'
          aria-label='Ukryj ten składnik'
          aria-pressed={!visible}
          onClick={() => onToggleVisible(ingredient.id)}
        >
          {visible ? <EyeIcon/> : <EyeOffIcon/>}
        </button>
      </Tooltip>
      {ingredient.type === 'solid'
        ? <EntitySprite id={ingredient.entityId}/>
        : <ReagentSprite id={ingredient.reagentId}/>
      }
      <span className='planner_editor-ingredient-name'>
        {ingredientName(ingredient, entityMap, reagentMap)}
      </span>
      {ingredient.recipes.map((id, index) =>
        <AddRecipeButton
          key={id}
          recipeId={id}
          index={index}
          totalCount={ingredient.recipes.length}
          onAdd={onAddRecipe}
        />
      )}
      <Tooltip text={tooltipText}>
        <span className='planner_editor-ingredient-info'>
          <InformationIcon/>
        </span>
      </Tooltip>
    </li>
  );
});

interface AddRecipeButtonProps {
  recipeId: string;
  index: number;
  totalCount: number;
  onAdd: (id: string) => void;
}

const AddRecipeButton = memo(({
  recipeId,
  index,
  totalCount,
  onAdd,
}: AddRecipeButtonProps): ReactElement => {
  const { parentRef, popupRef, visible } = usePopupTrigger<
    HTMLDivElement,
    HTMLButtonElement
  >('above');

  const n = index + 1;

  const ariaLabel = totalCount > 1
    ? `Dodaj przepis ${n} dla tego składnika do menu`
    : 'Dodaj przepis dla tego składnika do menu';

  return <>
    <button
      className='planner_editor-ingredient-add-recipe'
      aria-label={ariaLabel}
      onClick={() => onAdd(recipeId)}
      ref={parentRef}
    >
      <AddIcon/>
      {totalCount > 1 && <span>{n}</span>}
    </button>
    {visible && createPortal(
      <div className='popup popup--recipe' ref={popupRef}>
        <Recipe id={recipeId} canFavorite={false} canExplore={false}/>
        <span className='popup--tooltip'>
          Add this recipe to the menu.
        </span>
      </div>,
      getPopupRoot()
    )}
  </>;
});
