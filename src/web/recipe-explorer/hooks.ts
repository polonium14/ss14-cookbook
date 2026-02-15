import { useContext } from 'react';
import { ExploredRecipeContext, ExploreFnContext } from './context';

export const useExploreRecipe = () => useContext(ExploreFnContext);

export const useCurrentExploredRecipe = () => useContext(ExploredRecipeContext);
