import {ReactElement} from 'react';

export interface FetchErrorProps {
  message: string;
}

export const FetchError = (props: FetchErrorProps): ReactElement => {
  const {message} = props;
  return <>
    <p>{message} :(</p>
    <p>
      Może pomóc odświeżenie strony.
    </p>
  </>;
}
