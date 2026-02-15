import { ReactElement } from 'react';
import { useFork } from '../fork-context';
import { Notice } from '../notices';

export interface MenuWarningProps {
  menuFork: string;
  unavailableRecipeCount: number;
}

export const MenuWarning = ({
  menuFork,
  unavailableRecipeCount,
}: MenuWarningProps): ReactElement | null => {
  const { fork: currentFork, allForks } = useFork();

  if (menuFork === currentFork && unavailableRecipeCount === 0) {
    return null;
  }

  const targetMenuFork = allForks.find(f => f.id === menuFork);

  return (
    <Notice kind='warning'>
      <p>
        {menuFork !== currentFork &&
          `To menu zostało stworzone dla innego forka (${
            targetMenuFork?.name ?? '[niedostępny]'
          }). Przepisy i składniki mogą się różnić. `}
        {unavailableRecipeCount
          ? unavailableRecipeWarning(unavailableRecipeCount)
          : ''}
      </p>
    </Notice>
  );
};

const unavailableRecipeWarning = (count: number) => {
  if (count === 1) {
    return '1 przepis jest niedostępny.';
  }
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4 && (count < 10 || count > 20)) {
    return `${count} przepisy są niedostępne.`;
  }
  return `${count} przepisów jest niedostępnych.`;
};
