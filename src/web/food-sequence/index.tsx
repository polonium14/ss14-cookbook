import { ReactElement, memo, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { useGameData } from '../context';
import { NeutralCollator } from '../helpers';
import { SeqStartPoint } from './start-point';

export const FoodSequences = memo((): ReactElement => {
  const { entityList, entityMap, reagentMap } = useGameData();

  const startPoints = useMemo(() => {
    return entityList
      .filter(ent => ent.seqStart != null)
      .sort((a, b) => NeutralCollator.compare(a.name, b.name));
  }, [entityList, entityMap, reagentMap]);

  const { state } = useLocation();

  const startPointRefs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    const forEntity = state?.forEntity;
    if (typeof forEntity === 'string') {
      startPointRefs.current.get(forEntity)?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    }
  }, []);

  return (
    <main className='foodseq'>
      <p>Niektóre potrawy mogą zawierać dodatki, zazwyczaj w postaci innych produktów spożywczych, które można włożyć do środka lub, w przypadku bułek do burgerów, położyć na wierzchu. Trzymaj składnik w dłoni i kliknij odbiornik. W niektórych miejscach system ten nazywany jest <i>sekwencjami żywnościowymi</i>.</p>

      <ul className='foodseq_list'>
        {startPoints.map(ent =>
          <li
            key={ent.id}
            ref={elem => {
              if (elem) {
                startPointRefs.current.set(ent.id, elem);
              } else {
                startPointRefs.current.delete(ent.id);
              }
            }}
          >
            <SeqStartPoint entity={ent}/>
          </li>
        )}
      </ul>
    </main>
  );
});
