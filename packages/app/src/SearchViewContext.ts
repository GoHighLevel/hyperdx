import { createContext, Dispatch, SetStateAction, use } from 'react';
import type { SearchView } from '@hyperdx/common-utils/dist/types';

export type SearchViewContextValue = {
  sourceId?: string;
  layout?: SearchView['layout'];
  preferences: SearchView['preferences'];
  setPreferences: Dispatch<SetStateAction<SearchView['preferences']>>;
  userPreferences?: SearchView['userPreferences'];
  setUserPreferences: Dispatch<
    SetStateAction<SearchView['userPreferences'] | undefined>
  >;
  sharedPins?: SearchView['sharedPins'];
  setSharedPins: Dispatch<SetStateAction<SearchView['sharedPins'] | undefined>>;
  personalPins?: SearchView['personalPins'];
  setPersonalPins: (
    change: (pins: SearchView['personalPins']) => SearchView['personalPins'],
  ) => void;
};

export const SearchViewContext = createContext<SearchViewContextValue | null>(
  null,
);
export const useSearchView = () => use(SearchViewContext);
