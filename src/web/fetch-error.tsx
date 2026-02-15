import { ReactElement } from 'react';

export interface FetchErrorProps {
  message: string;
}

export const FetchError = ({ message }: FetchErrorProps): ReactElement => {
  return <>
    <p>{message} :(</p>
    <p>
      Może pomóc odświeżenie strony.
    </p>
  </>;
}
